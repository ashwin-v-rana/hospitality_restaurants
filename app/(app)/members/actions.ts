"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { searchMembers, type Member } from "@/lib/queries";
import {
  createMember,
  updateMember,
  type MemberInput,
  type MemberResult,
} from "@/lib/rpc";

/** Member search for the management list (RLS allows reading all members). */
export async function searchMembersAction(term: string): Promise<Member[]> {
  const supabase = await createClient();
  return searchMembers(supabase, term, 50);
}

export async function createMemberAction(
  input: MemberInput,
): Promise<MemberResult> {
  const supabase = await createClient();
  const result = await createMember(supabase, input);
  if (result.ok) revalidatePath("/members");
  return result;
}

export async function updateMemberAction(
  memberId: string,
  input: MemberInput,
): Promise<MemberResult> {
  const supabase = await createClient();
  const result = await updateMember(supabase, memberId, input);
  if (result.ok) revalidatePath("/members");
  return result;
}
