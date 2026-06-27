import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

/**
 * Server-only Supabase client using the SERVICE-ROLE key. Authentication is
 * app-managed (see lib/auth.ts), so there's no per-request Supabase session and
 * RLS no longer scopes reads — every server read/write goes through this client
 * and authorization is enforced in app code from the signed session.
 *
 * NEVER import this from a Client Component. The service-role key bypasses RLS
 * and must never reach the browser (it is not a NEXT_PUBLIC_* var).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
