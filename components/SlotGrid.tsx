"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BookingDialog, type BookingTarget } from "@/components/BookingDialog";
import { formatTime } from "@/lib/constants";
import type { TimeSlot } from "@/lib/queries";

export function SlotGrid({
  slots,
  restaurantId,
  partySize,
}: {
  slots: TimeSlot[];
  restaurantId: string;
  partySize: number;
}) {
  const [target, setTarget] = useState<BookingTarget | null>(null);

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        <p className="font-medium text-foreground">No seatings for this date</p>
        <p className="mt-1 text-sm">
          There are no time slots for the selected date. Try another date within
          the seeded window.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {slots.map((slot) => {
          const open = slot.capacity_remaining > 0;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!open}
              onClick={() =>
                setTarget({
                  restaurantId,
                  slotDate: slot.slot_date,
                  slotTime: slot.slot_time,
                  partySize,
                  capacityRemaining: slot.capacity_remaining,
                })
              }
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                open
                  ? "border-border bg-card hover:border-primary hover:bg-accent"
                  : "cursor-not-allowed border-dashed bg-muted/40 text-muted-foreground",
              )}
            >
              <span className="font-mono text-sm font-medium">
                {formatTime(slot.slot_time)}
              </span>
              <span
                className={cn(
                  "text-xs",
                  open ? "text-muted-foreground" : "text-muted-foreground",
                )}
              >
                {open ? (
                  <>
                    {slot.capacity_remaining} of {slot.capacity_total} open
                  </>
                ) : (
                  "Full"
                )}
              </span>
            </button>
          );
        })}
      </div>

      <BookingDialog
        target={target}
        onOpenChange={(o) => {
          if (!o) setTarget(null);
        }}
      />
    </>
  );
}
