import Link from "next/link";
import { CalendarSearch, BookMarked, Users, Armchair } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { getTimeSlots, getReservations } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReservationTable } from "@/components/ReservationTable";
import { todayISO, formatDate } from "@/lib/constants";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {selected.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Today · {formatDate(today)}
          </p>
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
        <StatCard
          label="Booked today"
          value={booked.length}
          hint="Active reservations"
          icon={BookMarked}
        />
        <StatCard
          label="Covers"
          value={covers}
          hint="Guests expected"
          icon={Users}
        />
        <StatCard
          label="Seats open"
          value={seatsOpen}
          hint={`of ${seatsTotal} across ${slots.length} seatings`}
          icon={Armchair}
        />
        <StatCard
          label="Seatings"
          value={slots.length}
          hint="Time slots today"
          icon={CalendarSearch}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Today&apos;s book</h2>
        <ReservationTable reservations={reservations} />
      </div>
    </div>
  );
}
