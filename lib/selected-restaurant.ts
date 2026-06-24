import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAssignedRestaurants, type Restaurant } from "@/lib/queries";
import { SELECTED_RESTAURANT_COOKIE } from "@/lib/constants";

export type RestaurantScope = {
  restaurants: Restaurant[];
  selected: Restaurant | null;
};

/**
 * Resolve the agent's restaurant scope: the RLS-filtered list of assigned
 * restaurants plus the currently selected one (from the cookie, falling back to
 * the first assigned restaurant). Never trusts the cookie blindly — the id must
 * be in the RLS-scoped list to count.
 */
export async function getRestaurantScope(): Promise<RestaurantScope> {
  const supabase = await createClient();
  const restaurants = await getAssignedRestaurants(supabase);

  const cookieStore = await cookies();
  const cookieId = cookieStore.get(SELECTED_RESTAURANT_COOKIE)?.value;

  const selected =
    restaurants.find((r) => r.id === cookieId) ?? restaurants[0] ?? null;

  return { restaurants, selected };
}
