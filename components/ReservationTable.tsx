"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookMarked, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { cancelAction } from "@/app/(app)/actions";
import { formatTime, formatDate } from "@/lib/constants";
import type { ReservationWithMember } from "@/lib/queries";

export function ReservationTable({
  reservations,
  showDate = false,
}: {
  reservations: ReservationWithMember[];
  /** Prepend a Date column — used by the cross-date "Upcoming" view. */
  showDate?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function cancel(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await cancelAction(id);
      if (result.ok) {
        if (result.alreadyCancelled) {
          toast.info("Already cancelled");
        } else {
          toast.success("Reservation cancelled", {
            description: "The seat has been returned to inventory.",
          });
        }
        router.refresh();
      } else {
        toast.error("Cancel failed", { description: result.message });
      }
      setPendingId(null);
    });
  }

  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={BookMarked}
        title="No reservations"
        description={
          showDate
            ? "There are no upcoming reservations."
            : "There are no reservations for this date."
        }
      />
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {showDate && <TableHead className="w-[110px]">Date</TableHead>}
            <TableHead className="w-[90px]">Time</TableHead>
            <TableHead>Member</TableHead>
            <TableHead className="w-[80px] text-center">Party</TableHead>
            <TableHead className="w-[110px]">Confirmation</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-[110px]">Status</TableHead>
            <TableHead className="w-[110px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((r) => {
            const cancelled = r.status === "cancelled";
            const note = [r.occasion, r.special_request]
              .filter(Boolean)
              .join(" · ");
            return (
              <TableRow key={r.id} className={cancelled ? "opacity-60" : ""}>
                {showDate && (
                  <TableCell className="font-medium">
                    {formatDate(r.slot_date)}
                  </TableCell>
                )}
                <TableCell className="font-mono font-medium">
                  {formatTime(r.slot_time)}
                </TableCell>
                <TableCell>
                  {r.members ? (
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        first={r.members.first_name}
                        last={r.members.last_name}
                        seed={r.member_id}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {r.members.first_name} {r.members.last_name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.members.member_number}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">{r.party_size}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.confirmation_code}
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                  {note || "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={cancelled ? "outline" : "default"}
                    className={
                      cancelled
                        ? "text-muted-foreground"
                        : "bg-emerald-600 text-white"
                    }
                  >
                    {cancelled ? "Cancelled" : "Booked"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {cancelled ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={pendingId === r.id}
                      onClick={() => cancel(r.id)}
                    >
                      <X className="size-4" />
                      {pendingId === r.id ? "Cancelling…" : "Cancel"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
