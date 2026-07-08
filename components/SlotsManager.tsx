"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, CalendarRange, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  generateSlotsAction,
  extendSlotsAction,
  type SlotsActionResult,
} from "@/app/(app)/admin/slots/actions";
import { formatDate, formatTime } from "@/lib/constants";
import type { ServiceWindow, SlotInventory } from "@/lib/queries";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_CAPACITY = 5;
const DEFAULT_WINDOW_DAYS = 14;
const EXTEND_DAYS = 14;

/** Add N days to a yyyy-mm-dd string (UTC-safe), returning yyyy-mm-dd. */
function addDays(iso: string, days: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function SlotsManager({
  restaurantId,
  restaurantName,
  windows,
  inventory,
  today,
}: {
  restaurantId: string;
  restaurantName: string;
  windows: ServiceWindow[];
  inventory: SlotInventory;
  today: string;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, DEFAULT_WINDOW_DAYS - 1));
  const [capacity, setCapacity] = useState(String(DEFAULT_CAPACITY));
  const [pending, startTransition] = useTransition();
  const [extending, setExtending] = useState(false);

  const daysWithService = useMemo(
    () => new Set(windows.map((w) => w.day_of_week)),
    [windows],
  );
  const missingDays = DAY_NAMES.map((_, i) => i).filter(
    (d) => !daysWithService.has(d),
  );

  const capacityNum = Number(capacity);
  const validRange = startDate >= today && endDate >= startDate;
  const validCapacity =
    Number.isInteger(capacityNum) && capacityNum >= 1 && capacityNum <= 50;
  const canGenerate = validRange && validCapacity && !pending && !extending;

  function handleResult(result: SlotsActionResult, verb: string) {
    if (result.ok) {
      if (result.inserted === 0) {
        toast.info("Nothing to add", {
          description: `Every slot in that window already exists for ${restaurantName}.`,
        });
      } else {
        toast.success(`${result.inserted} slot${result.inserted === 1 ? "" : "s"} ${verb}`, {
          description: `${formatDate(result.startDate)} → ${formatDate(result.endDate)}`,
        });
      }
      router.refresh();
    } else {
      toast.error("Could not generate slots", { description: result.message });
    }
  }

  function generate() {
    if (!canGenerate) return;
    startTransition(async () => {
      const result = await generateSlotsAction({
        restaurantId,
        startDate,
        endDate,
        capacity: capacityNum,
      });
      handleResult(result, "added");
    });
  }

  function extend() {
    const cap = validCapacity ? capacityNum : DEFAULT_CAPACITY;
    setExtending(true);
    startTransition(async () => {
      const result = await extendSlotsAction({
        restaurantId,
        capacity: cap,
        days: EXTEND_DAYS,
      });
      handleResult(result, "added");
      setExtending(false);
    });
  }

  return (
    <div className="space-y-5">
      {/* Current coverage */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Current coverage</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {inventory.lastSlotDate ? (
                <>
                  Booked through{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(inventory.lastSlotDate)}
                  </span>{" "}
                  · {inventory.futureBookable} bookable of {inventory.futureSlots}{" "}
                  upcoming slot{inventory.futureSlots === 1 ? "" : "s"}
                </>
              ) : (
                "No slots on the book yet."
              )}
            </p>
            {inventory.futureSlots === 0 ? (
              <p className="mt-1 text-sm text-[var(--color-rust)]">
                No upcoming availability — guests can&apos;t be booked until you
                open slots below.
              </p>
            ) : null}
          </div>
          <Button variant="outline" onClick={extend} disabled={pending || extending}>
            <Sparkles className="size-4" />
            {extending ? "Opening…" : `Open next ${EXTEND_DAYS} days`}
          </Button>
        </div>
      </div>

      {/* Manual range generator */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Generate a date range
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="slot-start">Start date</Label>
            <Input
              id="slot-start"
              type="date"
              min={today}
              value={startDate}
              onChange={(e) => {
                const v = e.target.value;
                setStartDate(v);
                if (endDate < v) setEndDate(v);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-end">End date</Label>
            <Input
              id="slot-end"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-cap">Seats per slot</Label>
            <Input
              id="slot-cap"
              type="number"
              min={1}
              max={50}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Slots are placed on {restaurantName}&apos;s 15-minute grid within each
            day&apos;s service window. Existing slots are left untouched.
          </p>
          <Button onClick={generate} disabled={!canGenerate}>
            <CalendarPlus className="size-4" />
            {pending && !extending ? "Generating…" : "Generate slots"}
          </Button>
        </div>
      </div>

      {/* Service windows reference */}
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Service windows
        </h3>
        <div className="flex flex-wrap gap-2">
          {DAY_NAMES.map((name, dow) => {
            const dayWindows = windows.filter((w) => w.day_of_week === dow);
            return (
              <div
                key={dow}
                className="flex min-w-[128px] flex-col gap-1 rounded-xl border px-3 py-2"
              >
                <span className="text-xs font-semibold text-foreground">{name}</span>
                {dayWindows.length > 0 ? (
                  dayWindows.map((w) => (
                    <span key={w.id} className="text-xs text-muted-foreground">
                      {formatTime(w.open_time)} – {formatTime(w.close_time)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground/60">Closed</span>
                )}
              </div>
            );
          })}
        </div>
        {missingDays.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-1.5 align-middle">
              Note
            </Badge>
            No slots are generated for days without a service window (
            {missingDays.map((d) => DAY_NAMES[d]).join(", ")}).
          </p>
        ) : null}
      </div>
    </div>
  );
}
