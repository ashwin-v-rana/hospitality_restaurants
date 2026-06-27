"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentAgent } from "@/lib/agent";
import { agentHasRestaurant } from "@/lib/authz";
import { SELECTED_RESTAURANT_COOKIE } from "@/lib/constants";

/**
 * Persist the selected restaurant in a cookie. Re-checks that the agent is
 * actually assigned to it before trusting the input, so a tampered value can
 * never widen access. (RLS no longer does this — auth is app-managed.)
 */
export async function setSelectedRestaurant(restaurantId: string) {
  const agent = await getCurrentAgent();
  if (!agent || !(await agentHasRestaurant(agent.id, restaurantId))) {
    // Not signed in / not assigned — ignore silently.
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(SELECTED_RESTAURANT_COOKIE, restaurantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
