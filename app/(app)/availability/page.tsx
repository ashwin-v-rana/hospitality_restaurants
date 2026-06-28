import { createClient } from "@/lib/supabase/server";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { getTimeSlots, getServiceWindows } from "@/lib/queries";
import { AvailabilityControls } from "@/components/AvailabilityControls";
import { SlotGrid } from "@/components/SlotGrid";
import { LargePartyNotice } from "@/components/LargePartyNotice";
import {
  todayISO,
  dowFromDate,
  formatTime,
  formatDate,
  MAX_PARTY_SIZE,
} from "@/lib/constants";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; party?: string }>;
}) {
  const { selected } = await getRestaurantScope();
  if (!selected) return null; // layout already shows the empty state

  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const partyRaw = Number(sp.party ?? "2");
  const partySize = Number.isFinite(partyRaw)
    ? Math.min(Math.max(Math.trunc(partyRaw), 1), MAX_PARTY_SIZE)
    : 2;

  const supabase = await createClient();
  const [slots, windows] = await Promise.all([
    getTimeSlots(supabase, selected.id, date),
    getServiceWindows(supabase, selected.id),
  ]);

  const dow = dowFromDate(date);
  const dayWindows = windows.filter((w) => w.day_of_week === dow);

  const totalOpen = slots.reduce(
    (sum, s) => sum + (s.capacity_remaining > 0 ? s.capacity_remaining : 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-medium tracking-tight text-[var(--color-ink)]">
            Availability
          </h2>
          <p className="text-sm text-muted-foreground">
            {selected.name} · {formatDate(date)}
            {dayWindows.length > 0 ? (
              <>
                {" "}
                ·{" "}
                {dayWindows
                  .map(
                    (w) =>
                      `${w.service_name} ${formatTime(w.open_time)}–${formatTime(
                        w.close_time,
                      )}`,
                  )
                  .join(", ")}
              </>
            ) : (
              <> · closed this day</>
            )}
          </p>
        </div>
        <AvailabilityControls date={date} partySize={partySize} />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex size-2 rounded-full bg-primary" />
        {totalOpen} seat{totalOpen === 1 ? "" : "s"} open across {slots.length}{" "}
        seating{slots.length === 1 ? "" : "s"} · {partySize}-guest turn applies
      </div>

      <SlotGrid slots={slots} restaurantId={selected.id} partySize={partySize} />

      <LargePartyNotice phone={selected.large_party_phone} />
    </div>
  );
}
