import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { getReservations, getUpcomingReservations } from "@/lib/queries";
import { ReservationTable } from "@/components/ReservationTable";
import { DatePicker } from "@/components/DatePicker";
import { todayISO, formatDate } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { selected } = await getRestaurantScope();
  if (!selected) return null;

  const sp = await searchParams;
  const upcoming = sp.view === "upcoming";
  const today = todayISO();
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const supabase = await createClient();
  const reservations = upcoming
    ? await getUpcomingReservations(supabase, selected.id, today)
    : await getReservations(supabase, selected.id, date);

  const booked = reservations.filter((r) => r.status === "booked").length;
  const covers = reservations
    .filter((r) => r.status === "booked")
    .reduce((sum, r) => sum + r.party_size, 0);

  const scope = upcoming ? `from ${formatDate(today)}` : formatDate(date);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservations</h1>
          <p className="text-sm text-muted-foreground">
            {selected.name} · {scope} · {booked} booked · {covers} cover
            {covers === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-end gap-4">
          <ViewToggle upcoming={upcoming} />
          {!upcoming && <DatePicker date={date} />}
        </div>
      </div>

      <ReservationTable reservations={reservations} showDate={upcoming} />
    </div>
  );
}

function ViewToggle({ upcoming }: { upcoming: boolean }) {
  const base =
    "px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md";
  return (
    <div className="inline-flex rounded-md border">
      <Link
        href="/reservations"
        className={cn(
          base,
          !upcoming
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        By date
      </Link>
      <Link
        href="/reservations?view=upcoming"
        className={cn(
          base,
          "border-l",
          upcoming
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        Upcoming
      </Link>
    </div>
  );
}
