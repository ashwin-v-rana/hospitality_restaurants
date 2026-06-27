import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { getAllAgents, getAssignedRestaurants } from "@/lib/queries";
import { AgentsManager } from "@/components/AgentsManager";

export default async function AdminAgentsPage() {
  const agent = await getCurrentAgent();
  // Admin-only. The RPCs enforce this server-side too; this is the UI gate.
  if (!agent || agent.role !== "admin") redirect("/");

  const supabase = await createClient();
  const [agents, restaurants] = await Promise.all([
    getAllAgents(supabase),
    getAssignedRestaurants(supabase), // admins read all restaurants via RLS
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Manage roles, restaurant access, and active status. New accounts are
          created with the seed script.
        </p>
      </div>
      <AgentsManager
        agents={agents}
        restaurants={restaurants}
        currentAgentId={agent.id}
      />
    </div>
  );
}
