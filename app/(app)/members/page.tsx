import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { getMembers } from "@/lib/queries";
import { MembersManager } from "@/components/MembersManager";

export default async function MembersPage() {
  const supabase = await createClient();
  const [agent, members] = await Promise.all([
    getCurrentAgent(),
    getMembers(supabase),
  ]);
  // Member writes are manager/admin-only (mirrors the create_member /
  // update_member RPC checks); hosts get a read-only directory for lookups.
  const canManage =
    agent?.role === "manager" || agent?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "Search, add, and edit members. Bookings stay attached to their NED- number."
            : "Search the member directory. Adding and editing is limited to managers."}
        </p>
      </div>
      <MembersManager initialMembers={members} canManage={canManage} />
    </div>
  );
}
