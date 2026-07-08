import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAgent } from "@/lib/agent";
import { getRestaurantScope } from "@/lib/selected-restaurant";
import { getServiceWindows, getSlotInventory } from "@/lib/queries";
import { todayISO } from "@/lib/constants";
import { SlotsManager } from "@/components/SlotsManager";
import { EmptyState } from "@/components/EmptyState";

export default async function AdminSlotsPage() {
  const agent = await getCurrentAgent();
  // Admin-only. The actions re-check this server-side; this is the UI gate.
  if (!agent || agent.role !== "admin") redirect("/");

  const { selected } = await getRestaurantScope();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl font-medium tracking-tight text-[var(--color-ink)]">
          Slots
        </h2>
        <p className="text-sm text-muted-foreground">
          Open bookable availability for{" "}
          <span className="font-medium text-foreground">
            {selected?.name ?? "the selected restaurant"}
          </span>
          . New slots follow each day&apos;s service window and never overwrite
          existing bookings.
        </p>
      </div>

      {selected ? (
        <SlotsManagerLoader restaurantId={selected.id} restaurantName={selected.name} />
      ) : (
        <EmptyState
          title="No restaurant selected"
          description="Pick a restaurant from the switcher to manage its slots."
        />
      )}
    </div>
  );
}

async function SlotsManagerLoader({
  restaurantId,
  restaurantName,
}: {
  restaurantId: string;
  restaurantName: string;
}) {
  const supabase = await createClient();
  const today = todayISO();
  const [windows, inventory] = await Promise.all([
    getServiceWindows(supabase, restaurantId),
    getSlotInventory(supabase, restaurantId, today),
  ]);

  return (
    <SlotsManager
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      windows={windows}
      inventory={inventory}
      today={today}
    />
  );
}
