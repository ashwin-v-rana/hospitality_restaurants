import { createClient } from "@/lib/supabase/server";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { getReservations } from "@/lib/queries";
import { ReservationTable } from "@/components/ReservationTable";
import { DatePicker } from "@/components/DatePicker";
import { todayISO, formatDate } from "@/lib/constants";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { selected } = await getRestaurantScope();
  if (!selected) return null;

  const sp = await searchParams;
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();

  const supabase = await createClient();
  const reservations = await getReservations(supabase, selected.id, date);

  const booked = reservations.filter((r) => r.status === "booked").length;
  const covers = reservations
    .filter((r) => r.status === "booked")
    .reduce((sum, r) => sum + r.party_size, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservations</h1>
          <p className="text-sm text-muted-foreground">
            {selected.name} · {formatDate(date)} · {booked} booked · {covers}{" "}
            cover{covers === 1 ? "" : "s"}
          </p>
        </div>
        <DatePicker date={date} />
      </div>

      <ReservationTable reservations={reservations} />
    </div>
  );
}
