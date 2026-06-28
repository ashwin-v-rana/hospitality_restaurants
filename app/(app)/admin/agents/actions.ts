"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { hashPassword } from "@/lib/auth-server";
import { isAdmin } from "@/lib/authz";
import type { TablesUpdate } from "@/lib/types";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

const ROLES = ["host", "manager", "admin"];

async function requireAdmin() {
  const agent = await getCurrentAgent();
  return agent && isAdmin(agent.role) ? agent : null;
}

/**
 * Create a new agent (admin only). Account creation is app-managed now: insert
 * an agents row with a bcrypt temp password and must_change_password = true. The
 * new agent is auto-assigned to the admin's currently selected restaurant.
 */
export async function createAgentAction(input: {
  email: string;
  fullName: string;
  role: string;
  password: string;
}): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!email.includes("@")) return { ok: false, message: "A valid email is required." };
  if (!fullName) return { ok: false, message: "Full name is required." };
  if (!ROLES.includes(input.role)) return { ok: false, message: "Invalid role." };
  if (input.password.length < 8) {
    return { ok: false, message: "Temporary password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const password_hash = await hashPassword(input.password);
  const { data, error } = await supabase
    .from("agents")
    .insert({
      email,
      full_name: fullName,
      role: input.role,
      password_hash,
      must_change_password: true,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: `An agent with email ${email} already exists.` };
    }
    return { ok: false, message: error.message };
  }

  // Auto-assign to the admin's selected restaurant so they aren't stranded.
  const { selected } = await getRestaurantScope();
  if (selected) {
    await supabase
      .from("agent_restaurants")
      .upsert(
        { agent_id: data.id, restaurant_id: selected.id },
        { onConflict: "agent_id,restaurant_id" },
      );
  }

  revalidatePath("/admin/agents");
  return { ok: true };
}

/** Edit name / role / active (admin only; self-lockout guards). */
export async function updateAgentAction(
  agentId: string,
  patch: { fullName?: string; role?: string; isActive?: boolean },
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };

  const update: TablesUpdate<"agents"> = {};
  if (patch.fullName !== undefined) {
    const fullName = patch.fullName.trim();
    if (!fullName) return { ok: false, message: "Full name is required." };
    update.full_name = fullName;
  }
  if (patch.role !== undefined) {
    if (!ROLES.includes(patch.role)) return { ok: false, message: "Invalid role." };
    if (agentId === admin.id && patch.role !== "admin") {
      return { ok: false, message: "You cannot change your own role." };
    }
    update.role = patch.role;
  }
  if (patch.isActive !== undefined) {
    if (agentId === admin.id && patch.isActive === false) {
      return { ok: false, message: "You cannot deactivate your own account." };
    }
    update.is_active = patch.isActive;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("agents").update(update).eq("id", agentId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/agents");
  return { ok: true };
}

/** Reset an agent's password to a new temp value (forces change on next login). */
export async function resetAgentPasswordAction(
  agentId: string,
  password: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };
  if (password.length < 8) {
    return { ok: false, message: "Temporary password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const password_hash = await hashPassword(password);
  const { error } = await supabase
    .from("agents")
    .update({ password_hash, must_change_password: true })
    .eq("id", agentId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/admin/agents");
  return { ok: true };
}

/** Delete an agent (admin only; can't delete yourself). Links cascade. */
export async function deleteAgentAction(
  agentId: string,
): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, message: "Admin role required." };
  if (agentId === admin.id) {
    return { ok: false, message: "You cannot delete yourself." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("agents").delete().eq("id", agentId);
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
