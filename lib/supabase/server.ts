import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side Supabase client for data access. Authentication is app-managed
 * (lib/auth.ts), so this returns the SERVICE-ROLE client — there is no
 * per-request Supabase session. Authorization is enforced in app code from the
 * signed session, NOT by RLS. Kept async so existing `await createClient()`
 * call sites keep working.
 */
export async function createClient() {
  return createAdminClient();
}
