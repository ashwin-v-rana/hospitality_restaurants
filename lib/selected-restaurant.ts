import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAgent } from "@/lib/agent";
import { getAssignedRestaurants, type Restaurant } from "@/lib/queries";
import { SELECTED_RESTAURANT_COOKIE } from "@/lib/constants";

export type RestaurantScope = {
  restaurants: Restaurant[];
  selected: Restaurant | null;
};

/**
 * Resolve the agent's restaurant scope: the agent's assigned restaurants plus
 * the currently selected one (from the cookie, falling back to the first
 * assigned). Never trusts the cookie blindly — the id must be in the assigned
 * list to count.
 */
export async function getRestaurantScope(): Promise<RestaurantScope> {
  const agent = await getCurrentAgent();
  if (!agent) return { restaurants: [], selected: null };

  const supabase = createAdminClient();
  const restaurants = await getAssignedRestaurants(supabase, agent.id);

  const cookieStore = await cookies();
  const cookieId = cookieStore.get(SELECTED_RESTAURANT_COOKIE)?.value;

  const selected =
    restaurants.find((r) => r.id === cookieId) ?? restaurants[0] ?? null;

  return { restaurants, selected };
}
