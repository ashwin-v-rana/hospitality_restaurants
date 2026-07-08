"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { getAssignedRestaurants } from "@/lib/queries";
import { isAdmin } from "@/lib/authz";
import { generateTimeSlots } from "@/lib/rpc";
import { todayISO } from "@/lib/constants";

export type SlotsActionResult =
  | { ok: true; inserted: number; startDate: string; endDate: string }
  | { ok: false; message: string };

const MAX_RANGE_DAYS = 92; // mirrors the generate_time_slots RPC guard
const MIN_CAPACITY = 1;
const MAX_CAPACITY = 50;
const DEFAULT_EXTEND_DAYS = 14;

async function requireAdmin() {
  const agent = await getCurrentAgent();
  return agent && isAdmin(agent.role) ? agent : null;
}

/** Add N days to a yyyy-mm-dd string, returning yyyy-mm-dd (UTC-safe). */
function addDays(iso: string, days: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** True for a well-formed yyyy-mm-dd date string. */
function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

/**
 * Shared generation path: re-checks admin, verifies the restaurant is in the
 * caller's scope, enforces future-only + range/capacity guards, then calls the
 * RPC. Both the manual "generate" and one-click "extend" flows route through it.
 */
async function generate(
  restaurantId: string,
  startDate: string,
  endDate: string,
  capacity: number,
): Promise<SlotsActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return { ok: false, message: "Invalid date." };
  }
  const today = todayISO();
  if (startDate < today) {
    return { ok: false, message: "Start date can't be in the past." };
  }
  if (endDate < startDate) {
    return { ok: false, message: "End date must be on or after the start date." };
  }
  // Guard the range in the app too, for a friendlier message than the RPC's.
  const rangeDays =
    (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
  if (rangeDays > MAX_RANGE_DAYS) {
    return {
      ok: false,
      message: `Date range is too large (max ${MAX_RANGE_DAYS} days). Generate it in smaller windows.`,
    };
  }
  if (
    !Number.isInteger(capacity) ||
    capacity < MIN_CAPACITY ||
    capacity > MAX_CAPACITY
  ) {
    return {
      ok: false,
      message: `Capacity must be a whole number between ${MIN_CAPACITY} and ${MAX_CAPACITY}.`,
    };
  }

  // Scope check: an admin may only generate for a restaurant they're assigned
  // to (matches the switcher scope; never trust the client-supplied id blindly).
  const supabase = await createClient();
  const scope = await getAssignedRestaurants(supabase, admin.id);
  if (!scope.some((r) => r.id === restaurantId)) {
    return { ok: false, message: "You don't have access to that restaurant." };
  }

  const result = await generateTimeSlots(supabase, {
    restaurantId,
    startDate,
    endDate,
    capacity,
  });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/admin/slots");
  revalidatePath("/availability");
  return { ok: true, inserted: result.inserted, startDate, endDate };
}

/** Generate slots for an explicit date range (admin only, future dates only). */
export async function generateSlotsAction(input: {
  restaurantId: string;
  startDate: string;
  endDate: string;
  capacity: number;
}): Promise<SlotsActionResult> {
  return generate(
    input.restaurantId,
    input.startDate,
    input.endDate,
    input.capacity,
  );
}

/**
 * One-click "open the next N days": generate from today through
 * max(last slot on the book, today) + N days. Idempotent, so it fills any gap
 * between today and the last slot *and* extends the horizon in one call.
 */
export async function extendSlotsAction(input: {
  restaurantId: string;
  capacity: number;
  days?: number;
}): Promise<SlotsActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };

  const days = input.days ?? DEFAULT_EXTEND_DAYS;
  const today = todayISO();

  const supabase = await createClient();
  const { data: lastRow, error } = await supabase
    .from("time_slots")
    .select("slot_date")
    .eq("restaurant_id", input.restaurantId)
    .order("slot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  const anchor =
    lastRow?.slot_date && lastRow.slot_date > today ? lastRow.slot_date : today;
  let endDate = addDays(anchor, days);
  // Never exceed the RPC's range cap when the last slot is already far out.
  const maxEnd = addDays(today, MAX_RANGE_DAYS);
  if (endDate > maxEnd) endDate = maxEnd;

  return generate(input.restaurantId, today, endDate, input.capacity);
}
