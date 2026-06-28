import { Activity, ShieldCheck, ShieldAlert, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthEvents } from "@/lib/queries";
import { isWithinHours } from "@/lib/constants";
import { KpiCard } from "@/components/KpiCard";
import { ActivityFeed } from "@/components/ActivityFeed";

export default async function ActivityPage() {
  const supabase = await createClient();
  const events = await getAuthEvents(supabase);

  const total = events.length;
  const failures = events.filter((e) => e.result === "failure").length;
  const membersSeen = new Set(
    events.filter((e) => e.member_id).map((e) => e.member_id),
  ).size;

  const last24 = events.filter((e) => isWithinHours(e.created_at, 24));
  const success24 = last24.filter((e) => e.result === "success").length;
  const rate24 = last24.length
    ? Math.round((success24 / last24.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-medium tracking-tight text-[var(--color-ink)]">
          Auth &amp; Activity
        </h2>
        <p className="text-sm text-muted-foreground">
          OTP authentication trail from the Cecconi Concierge AI agent (read-only).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Events"
          value={total}
          hint="All-time auth attempts"
          icon={Activity}
          accent="rust"
        />
        <KpiCard
          label="24h success rate"
          value={`${rate24}%`}
          hint={`${last24.length} attempt${last24.length === 1 ? "" : "s"} in 24h`}
          icon={ShieldCheck}
          accent="pine"
        />
        <KpiCard
          label="Failures"
          value={failures}
          hint="All-time failed auths"
          icon={ShieldAlert}
          accent="amber"
        />
        <KpiCard
          label="Members seen"
          value={membersSeen}
          hint="Distinct members authenticated"
          icon={Users}
          accent="gold"
        />
      </div>

      <ActivityFeed events={events} />
    </div>
  );
}
