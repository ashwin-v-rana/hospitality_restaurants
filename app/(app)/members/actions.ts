"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { canManageMembers } from "@/lib/authz";
import { searchMembers, type Member } from "@/lib/queries";
import {
  createMember,
  updateMember,
  type MemberInput,
  type MemberResult,
} from "@/lib/rpc";

/** Member search (any signed-in agent — used by the directory + combobox). */
export async function searchMembersAction(term: string): Promise<Member[]> {
  const agent = await getCurrentAgent();
  if (!agent) return [];
  const supabase = await createClient();
  return searchMembers(supabase, term, 50);
}

const DENIED: MemberResult = {
  ok: false,
  message: "Manager or admin role required.",
};

export async function createMemberAction(
  input: MemberInput,
): Promise<MemberResult> {
  const agent = await getCurrentAgent();
  if (!agent || !canManageMembers(agent.role)) return DENIED;

  const supabase = await createClient();
  const result = await createMember(supabase, input);
  if (result.ok) revalidatePath("/members");
  return result;
}

export async function updateMemberAction(
  memberId: string,
  input: MemberInput,
): Promise<MemberResult> {
  const agent = await getCurrentAgent();
  if (!agent || !canManageMembers(agent.role)) return DENIED;

  const supabase = await createClient();
  const result = await updateMember(supabase, memberId, input);
  if (result.ok) revalidatePath("/members");
  return result;
}
