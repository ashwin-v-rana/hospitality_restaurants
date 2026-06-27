import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession, SESSION_COOKIE, type SessionAgent } from "@/lib/auth";

export type CurrentAgent = {
  id: string;
  email: string;
  full_name: string | null;
  role: "host" | "manager" | "admin";
  is_active: boolean;
  must_change_password: boolean;
};

/**
 * The logged-in agent, derived from the signed session cookie and re-checked
 * against the DB so role / is_active / must_change_password are always current
 * (a deactivated or role-changed agent is reflected immediately, even though
 * their JWT is still otherwise valid). Returns null when not signed in,
 * deactivated, or the agent row is gone.
 */
export async function getCurrentAgent(): Promise<CurrentAgent | null> {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("id, email, full_name, role, is_active, must_change_password")
    .eq("id", session.id)
    .maybeSingle();

  if (!data || !data.is_active) return null;

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role as CurrentAgent["role"],
    is_active: data.is_active,
    must_change_password: data.must_change_password,
  };
}

/** Re-export so callers can build a session payload without a second import. */
export type { SessionAgent };
