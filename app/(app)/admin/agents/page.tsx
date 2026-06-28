import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { getAllAgents, getAllRestaurants } from "@/lib/queries";
import { AgentsManager } from "@/components/AgentsManager";

export default async function AdminAgentsPage() {
  const agent = await getCurrentAgent();
  // Admin-only. The actions re-check this server-side; this is the UI gate.
  if (!agent || agent.role !== "admin") redirect("/");

  const supabase = await createClient();
  const [agents, restaurants] = await Promise.all([
    getAllAgents(supabase),
    getAllRestaurants(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-medium tracking-tight text-[var(--color-ink)]">
          Agents
        </h2>
        <p className="text-sm text-muted-foreground">
          Add agents, manage roles, restaurant access, passwords, and active
          status.
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
