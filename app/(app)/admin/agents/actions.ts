"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

/** Change an agent's role. Guards (self-demotion, admin-only) live in the RPC. */
export async function setAgentRoleAction(
  agentId: string,
  role: string,
): Promise<AdminActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_agent_role", {
    p_agent_id: agentId,
    p_role: role,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/agents");
  return { ok: true };
}

/** Activate / deactivate an agent. Self-deactivation is blocked in the RPC. */
export async function setAgentActiveAction(
  agentId: string,
  active: boolean,
): Promise<AdminActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_agent_active", {
    p_agent_id: agentId,
    p_active: active,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/agents");
  return { ok: true };
}

/** Assign or unassign a restaurant for an agent. */
export async function assignRestaurantAction(
  agentId: string,
  restaurantId: string,
  assign: boolean,
): Promise<AdminActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_restaurant", {
    p_agent_id: agentId,
    p_restaurant_id: restaurantId,
    p_assign: assign,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/agents");
  return { ok: true };
}
