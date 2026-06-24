"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Clock, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberCombobox } from "@/components/MemberCombobox";
import { bookAction } from "@/app/(app)/actions";
import { formatDate, formatTime, turnMinutes } from "@/lib/constants";
import type { Member } from "@/lib/queries";

export type BookingTarget = {
  restaurantId: string;
  slotDate: string;
  slotTime: string;
  partySize: number;
  capacityRemaining: number;
};

export function BookingDialog({
  target,
  onOpenChange,
}: {
  target: BookingTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [occasion, setOccasion] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [pending, startTransition] = useTransition();

  const open = target !== null;

  function reset() {
    setMember(null);
    setOccasion("");
    setSpecialRequest("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function submit() {
    if (!target || !member) return;
    startTransition(async () => {
      const result = await bookAction({
        restaurantId: target.restaurantId,
        memberId: member.id,
        slotDate: target.slotDate,
        slotTime: target.slotTime,
        partySize: target.partySize,
        occasion: occasion.trim() || null,
        specialRequest: specialRequest.trim() || null,
      });

      if (result.ok) {
        toast.success("Reservation booked", {
          description: `Confirmation ${result.confirmationCode}`,
        });
        reset();
        onOpenChange(false);
        router.refresh();
      } else if (result.reason === "slot_full") {
        toast.error("Slot just filled", {
          description: "Someone took the last seat. Pick another time.",
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error("Booking failed", { description: result.message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book a table</DialogTitle>
          <DialogDescription>
            Attach a member to this seating. Confirmation code is generated on
            booking.
          </DialogDescription>
        </DialogHeader>

        {target ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarCheck className="size-3.5" /> Date
                </span>
                <span className="font-medium">
                  {formatDate(target.slotDate)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" /> Time
                </span>
                <span className="font-medium">
                  {formatTime(target.slotTime)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" /> Party
                </span>
                <span className="font-medium">
                  {target.partySize}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {turnMinutes(target.partySize)}m
                  </span>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Member</Label>
              <MemberCombobox value={member} onSelect={setMember} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="occasion">Occasion</Label>
                <Input
                  id="occasion"
                  placeholder="Birthday…"
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="special">Special request</Label>
                <Input
                  id="special"
                  placeholder="Window table…"
                  value={specialRequest}
                  onChange={(e) => setSpecialRequest(e.target.value)}
                />
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !member}>
            {pending ? "Booking…" : "Confirm booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
