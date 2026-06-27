"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import {
  setAgentRoleAction,
  setAgentActiveAction,
  assignRestaurantAction,
  type AdminActionResult,
} from "@/app/(app)/admin/agents/actions";
import type { AdminAgent, Restaurant } from "@/lib/queries";

const ROLES = ["host", "manager", "admin"] as const;

export function AgentsManager({
  agents,
  restaurants,
  currentAgentId,
}: {
  agents: AdminAgent[];
  restaurants: Restaurant[];
  currentAgentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Tracks the row/control currently mutating, to disable just that control.
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function run(key: string, fn: () => Promise<AdminActionResult>, ok: string) {
    setBusyKey(key);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error("Action failed", { description: result.message });
      }
      setBusyKey(null);
    });
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead className="w-[150px]">Role</TableHead>
            <TableHead>Restaurants</TableHead>
            <TableHead className="w-[150px] text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((a) => {
            const isSelf = a.id === currentAgentId;
            const assigned = new Set(
              a.agent_restaurants.map((l) => l.restaurant_id),
            );
            return (
              <TableRow key={a.id} className={a.is_active ? "" : "opacity-60"}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      first={a.full_name?.split(" ")[0] ?? a.email}
                      last={a.full_name?.split(" ")[1] ?? ""}
                      seed={a.id}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {a.full_name ?? "—"}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {a.email}
                      </span>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <Select
                    value={a.role}
                    onValueChange={(v) =>
                      v &&
                      v !== a.role &&
                      run(
                        `${a.id}:role`,
                        () => setAgentRoleAction(a.id, v),
                        "Role updated",
                      )
                    }
                    disabled={isSelf || (pending && busyKey === `${a.id}:role`)}
                  >
                    <SelectTrigger
                      className="w-[130px] capitalize"
                      aria-label={`Role for ${a.email}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSelf ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Can&apos;t change your own role
                    </p>
                  ) : null}
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {restaurants.map((r) => {
                      const on = assigned.has(r.id);
                      const key = `${a.id}:rest:${r.id}`;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={pending && busyKey === key}
                          onClick={() =>
                            run(
                              key,
                              () =>
                                assignRestaurantAction(a.id, r.id, !on),
                              on ? "Restaurant unassigned" : "Restaurant assigned",
                            )
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50",
                            on
                              ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                              : "border-dashed text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Badge
                      variant={a.is_active ? "default" : "outline"}
                      className={
                        a.is_active
                          ? "bg-emerald-600 text-white"
                          : "text-muted-foreground"
                      }
                    >
                      {a.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isSelf || (pending && busyKey === `${a.id}:active`)}
                      onClick={() =>
                        run(
                          `${a.id}:active`,
                          () => setAgentActiveAction(a.id, !a.is_active),
                          a.is_active ? "Agent deactivated" : "Agent activated",
                        )
                      }
                    >
                      {a.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
