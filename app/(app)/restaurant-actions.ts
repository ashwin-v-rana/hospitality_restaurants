"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SELECTED_RESTAURANT_COOKIE } from "@/lib/constants";

/**
 * Persist the selected restaurant in a cookie. Re-checks that the agent is
 * actually assigned to it (RLS) before trusting the input, so a tampered value
 * can never widen access.
 */
export async function setSelectedRestaurant(restaurantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    // Not assigned / not found — ignore silently.
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
