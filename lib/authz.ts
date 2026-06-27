import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Authorization helpers. With Supabase Auth removed, RLS no longer scopes data
 * and the RPCs no longer check auth.uid() — so every privileged server action
 * authorizes here, from the signed session, before touching the service-role
 * client.
 */

/** True if the agent is linked to the restaurant in agent_restaurants. */
export async function agentHasRestaurant(
  agentId: string,
  restaurantId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agent_restaurants")
    .select("restaurant_id")
    .eq("agent_id", agentId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return Boolean(data);
}

export function canManageMembers(role: string): boolean {
  return role === "manager" || role === "admin";
}

export function isAdmin(role: string): boolean {
  return role === "admin";
}
