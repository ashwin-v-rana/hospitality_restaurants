"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { isAdmin } from "@/lib/authz";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

const ROLES = ["host", "manager", "admin"];

async function requireAdmin() {
  const agent = await getCurrentAgent();
  return agent && isAdmin(agent.role) ? agent : null;
}

/** Change an agent's role (admin only; can't demote yourself). */
export async function setAgentRoleAction(
  agentId: string,
  role: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };
  if (!ROLES.includes(role)) return { ok: false, message: "Invalid role." };
  if (agentId === admin.id && role !== "admin") {
    return { ok: false, message: "You cannot change your own role." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("agents")
    .update({ role })
    .eq("id", agentId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/agents");
  return { ok: true };
}

/** Activate / deactivate an agent (admin only; can't deactivate yourself). */
export async function setAgentActiveAction(
  agentId: string,
  active: boolean,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };
  if (agentId === admin.id && !active) {
    return { ok: false, message: "You cannot deactivate your own account." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("agents")
    .update({ is_active: active })
    .eq("id", agentId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/agents");
  return { ok: true };
}

/** Assign or unassign a restaurant for an agent (admin only). */
export async function assignRestaurantAction(
  agentId: string,
  restaurantId: string,
  assign: boolean,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };

  const supabase = await createClient();
  if (assign) {
    const { error } = await supabase
      .from("agent_restaurants")
      .upsert(
        { agent_id: agentId, restaurant_id: restaurantId },
        { onConflict: "agent_id,restaurant_id" },
      );
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase
      .from("agent_restaurants")
      .delete()
      .eq("agent_id", agentId)
      .eq("restaurant_id", restaurantId);
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/admin/agents");
  return { ok: true };
}
