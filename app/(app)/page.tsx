import Link from "next/link";
import { CalendarSearch, BookMarked, Users, Armchair } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { getTimeSlots, getReservations } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/KpiCard";
import { CoversChart, type CoverPoint } from "@/components/CoversChart";
import { ReservationTable } from "@/components/ReservationTable";
import { todayISO, formatDate, formatTime } from "@/lib/constants";

export default async function DashboardPage() {
  const { selected } = await getRestaurantScope();
  if (!selected) return null;

  const today = todayISO();
  const supabase = await createClient();
  const [slots, reservations] = await Promise.all([
    getTimeSlots(supabase, selected.id, today),
    getReservations(supabase, selected.id, today),
  ]);

  const booked = reservations.filter((r) => r.status === "booked");
  const covers = booked.reduce((sum, r) => sum + r.party_size, 0);
  const seatsOpen = slots.reduce(
    (sum, s) => sum + (s.capacity_remaining > 0 ? s.capacity_remaining : 0),
    0,
  );
  const seatsTotal = slots.reduce((sum, s) => sum + s.capacity_total, 0);

  // Covers grouped by seating time, for the chart.
  const byTime = new Map<string, number>();
  for (const r of booked) {
    byTime.set(r.slot_time, (byTime.get(r.slot_time) ?? 0) + r.party_size);
  }
  const coverPoints: CoverPoint[] = [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, c]) => ({ label: formatTime(time), covers: c }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-medium tracking-tight text-[var(--color-ink)]">
            {selected.name}
          </h2>
          <p className="text-sm text-muted-foreground">Today · {formatDate(today)}</p>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href="/availability" />} variant="outline">
            <CalendarSearch className="size-4" />
            Check availability
          </Button>
          <Button render={<Link href="/reservations" />}>
            <BookMarked className="size-4" />
            All reservations
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Booked today"
          value={booked.length}
          hint="Active reservations"
          icon={BookMarked}
          accent="rust"
        />
        <KpiCard
          label="Covers"
          value={covers}
          hint="Guests expected"
          icon={Users}
          accent="pine"
        />
        <KpiCard
          label="Seats open"
          value={seatsOpen}
          hint={`of ${seatsTotal} across ${slots.length} seatings`}
          icon={Armchair}
          accent="amber"
        />
        <KpiCard
          label="Seatings"
          value={slots.length}
          hint="Time slots today"
          icon={CalendarSearch}
          accent="gold"
        />
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent-deep)]">
            Covers by seating
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CoversChart data={coverPoints} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-display text-xl font-medium text-[var(--color-ink)]">
          Today&apos;s book
        </h3>
        <ReservationTable reservations={reservations} />
      </div>
    </div>
  );
}
