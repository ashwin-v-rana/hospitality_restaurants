import type { DB, Member } from "@/lib/queries";

export type CreateReservationInput = {
  restaurantId: string;
  memberId: string;
  slotDate: string;
  slotTime: string;
  partySize: number;
  occasion?: string | null;
  specialRequest?: string | null;
};

export type CreateReservationResult =
  | { ok: true; confirmationCode: string; reservationId: string }
  | { ok: false; reason: "slot_full" | "error"; message: string };

/**
 * Atomic booking via the create_reservation RPC. The RPC decrements the slot and
 * inserts the reservation in one statement, so a full slot can never be oversold.
 *
 * A returned row = success (read confirmation_code from it).
 * Zero rows = the slot filled between the grid render and this call → "slot_full".
 */
export async function createReservation(
  supabase: DB,
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  const { data, error } = await supabase.rpc("create_reservation", {
    p_restaurant_id: input.restaurantId,
    p_member_id: input.memberId,
    p_slot_date: input.slotDate,
    p_slot_time: input.slotTime,
    p_party_size: input.partySize,
    p_occasion: input.occasion ?? undefined,
    p_special_request: input.specialRequest ?? undefined,
  });

  if (error) {
    return { ok: false, reason: "error", message: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.confirmation_code) {
    return {
      ok: false,
      reason: "slot_full",
      message: "That slot just filled. Please pick another time.",
    };
  }

  return {
    ok: true,
    confirmationCode: row.confirmation_code,
    reservationId: row.reservation_id,
  };
}

export type CancelResult =
  | { ok: true; alreadyCancelled: boolean }
  | { ok: false; message: string };

/** Cancel a reservation and return the seat to inventory via the RPC. */
export async function cancelReservation(
  supabase: DB,
  reservationId: string,
): Promise<CancelResult> {
  const { data, error } = await supabase.rpc("cancel_reservation", {
    p_reservation_id: reservationId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  // RPC returns true on a fresh cancel, false if it was already cancelled.
  return { ok: true, alreadyCancelled: data === false };
}

export type MemberInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
};

export type MemberResult =
  | { ok: true; member: Member }
  | { ok: false; message: string };

/**
 * Create a member via the create_member RPC. The RPC validates E.164, mints the
 * NED- number, and maps a duplicate phone to a friendly message. Available to any
 * authenticated agent (a host adding a walk-in guest), not admin-only.
 */
export async function createMember(
  supabase: DB,
  input: MemberInput,
): Promise<MemberResult> {
  const { data, error } = await supabase.rpc("create_member", {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone,
    p_email: input.email ?? undefined,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, member: data as Member };
}

export type GenerateSlotsInput = {
  restaurantId: string;
  startDate: string;
  endDate: string;
  capacity: number;
};

export type GenerateSlotsResult =
  | { ok: true; inserted: number }
  | { ok: false; message: string };

/**
 * Generate bookable time_slots for a restaurant across a date range via the
 * generate_time_slots RPC. The RPC steps by the restaurant's
 * slot_interval_minutes within each weekday's service window and inserts with
 * ON CONFLICT DO NOTHING, so it only *adds* missing slots — existing slots
 * (and any bookings against them) are never touched or oversold. Returns the
 * number of slots actually inserted.
 */
export async function generateTimeSlots(
  supabase: DB,
  input: GenerateSlotsInput,
): Promise<GenerateSlotsResult> {
  const { data, error } = await supabase.rpc("generate_time_slots", {
    p_restaurant_id: input.restaurantId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_capacity: input.capacity,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, inserted: data ?? 0 };
}

/** Update a member's name/phone/email via the update_member RPC. */
export async function updateMember(
  supabase: DB,
  memberId: string,
  input: MemberInput,
): Promise<MemberResult> {
  const { data, error } = await supabase.rpc("update_member", {
    p_member_id: memberId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone,
    p_email: input.email ?? undefined,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, member: data as Member };
}
