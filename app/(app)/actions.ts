"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { searchMembers, type Member } from "@/lib/queries";
import {
  createReservation,
  cancelReservation,
  type CreateReservationResult,
  type CancelResult,
} from "@/lib/rpc";

/** Member search for the combobox (RLS allows reading all members). */
export async function searchMembersAction(term: string): Promise<Member[]> {
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

/** Atomic booking via the create_reservation RPC. */
export async function bookAction(
  input: BookActionInput,
): Promise<CreateReservationResult> {
  const supabase = await createClient();
  const result = await createReservation(supabase, input);
  if (result.ok) {
    revalidatePath("/availability");
    revalidatePath("/reservations");
    revalidatePath("/");
  }
  return result;
}

/** Cancel via the cancel_reservation RPC; returns the seat to inventory. */
export async function cancelAction(reservationId: string): Promise<CancelResult> {
  const supabase = await createClient();
  const result = await cancelReservation(supabase, reservationId);
  if (result.ok) {
    revalidatePath("/reservations");
    revalidatePath("/availability");
    revalidatePath("/");
  }
  return result;
}
