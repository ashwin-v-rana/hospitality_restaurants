"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Search, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { MemberDialog } from "@/components/MemberDialog";
import { searchMembersAction } from "@/app/(app)/members/actions";
import type { Member, MemberWithCount } from "@/lib/queries";

export function MembersManager({
  initialMembers,
  canManage = false,
}: {
  initialMembers: MemberWithCount[];
  /** Manager/admin only — controls whether write actions are shown. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Member[] | null>(null);
  const [pending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  // Bumped on every open so MemberDialog remounts with fresh, prop-seeded state.
  const [dialogKey, setDialogKey] = useState(0);

  // Booked-count lookup from the server-rendered list, for display only.
  const countById = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of initialMembers) map.set(m.id, m.reservations?.[0]?.count ?? 0);
    return map;
  }, [initialMembers]);

  // Debounced search; empty term falls back to the server-rendered list. All
  // state updates happen inside the timeout so none run synchronously in the
  // effect body.
  useEffect(() => {
    const t = term.trim();
    const id = setTimeout(() => {
      startTransition(async () => {
        setResults(t.length === 0 ? null : await searchMembersAction(t));
      });
    }, t.length === 0 ? 0 : 200);
    return () => clearTimeout(id);
  }, [term]);

  const rows: Member[] = results ?? initialMembers;

  function openCreate() {
    setEditing(null);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function openEdit(member: Member) {
    setEditing(member);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name, NED- number, or phone…"
            className="pl-8"
          />
          {pending ? (
            <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        {canManage ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add member
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={term ? "No members match" : "No members yet"}
          description={
            term
              ? "Try a different name, number, or phone."
              : "Add your first member to start attaching bookings."
          }
          action={
            term || !canManage ? undefined : (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add member
              </Button>
            )
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="w-[130px]">Number</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[90px] text-center">Bookings</TableHead>
                {canManage ? (
                  <TableHead className="w-[90px] text-right">Edit</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const count = countById.get(m.id);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar first={m.first_name} last={m.last_name} seed={m.id} />
                        <span className="font-medium">
                          {m.first_name} {m.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {m.member_number}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{m.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.email || "—"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {count ?? "—"}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <MemberDialog
        key={dialogKey}
        open={dialogOpen}
        mode={editing ? "edit" : "create"}
        member={editing}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          // Pull fresh server data (and booked counts) after a write.
          setTerm("");
          setResults(null);
          router.refresh();
        }}
      />
    </div>
  );
}
