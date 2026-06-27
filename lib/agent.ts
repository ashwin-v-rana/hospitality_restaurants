import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CurrentAgent = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

/**
 * The logged-in agent's profile row (RLS lets an agent read its own row). Null
 * when not signed in or no agents row exists for the auth user.
 */
export async function getCurrentAgent(): Promise<CurrentAgent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("agents")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
}
