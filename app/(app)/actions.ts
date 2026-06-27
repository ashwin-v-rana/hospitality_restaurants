"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { agentHasRestaurant } from "@/lib/authz";
import { searchMembers, type Member } from "@/lib/queries";
import {
  createReservation,
  cancelReservation,
  type CreateReservationResult,
  type CancelResult,
} from "@/lib/rpc";

/** Member search for the combobox (any signed-in agent). */
export async function searchMembersAction(term: string): Promise<Member[]> {
  const agent = await getCurrentAgent();
  if (!agent) return [];
  const supabase = await createClient();
  return searchMembers(supabase, term);
}

export type BookActionInput = {
  restaurantId: string;
  memberId: string;
  slotDate: string;
  slotTime: string;
  partySize: number;
  occasion?: string | null;
  specialRequest?: string | null;
};

/** Atomic booking via the create_reservation RPC, gated by restaurant access. */
export async function bookAction(
  input: BookActionInput,
): Promise<CreateReservationResult> {
  const agent = await getCurrentAgent();
  if (!agent) return { ok: false, reason: "error", message: "Not signed in." };

  if (!(await agentHasRestaurant(agent.id, input.restaurantId))) {
    return {
      ok: false,
      reason: "error",
      message: "You are not assigned to this restaurant.",
    };
  }

  const supabase = await createClient();
  const result = await createReservation(supabase, input);
  if (result.ok) {
    revalidatePath("/availability");
    revalidatePath("/reservations");
    revalidatePath("/");
  }
  return result;
}

/** Cancel via the cancel_reservation RPC, gated by restaurant access. */
export async function cancelAction(
  reservationId: string,
): Promise<CancelResult> {
  const agent = await getCurrentAgent();
  if (!agent) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data: reservation } = await supabase
    .from("reservations")
    .select("restaurant_id")
    .eq("id", reservationId)
    .maybeSingle();
  if (!reservation) return { ok: false, message: "Reservation not found." };

  if (!(await agentHasRestaurant(agent.id, reservation.restaurant_id))) {
    return { ok: false, message: "You are not assigned to this restaurant." };
  }

  const result = await cancelReservation(supabase, reservationId);
  if (result.ok) {
    revalidatePath("/reservations");
    revalidatePath("/availability");
    revalidatePath("/");
  }
  return result;
}
