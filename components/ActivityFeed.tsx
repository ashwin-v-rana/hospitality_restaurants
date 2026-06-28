"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { formatEventTime } from "@/lib/constants";
import type { AuthEventWithMember } from "@/lib/queries";

export function ActivityFeed({ events }: { events: AuthEventWithMember[] }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (result !== "all" && e.result !== result) return false;
      if (q) {
        const m = e.members;
        const hay = `${m?.first_name ?? ""} ${m?.last_name ?? ""} ${
          m?.member_number ?? ""
        } ${m?.phone ?? ""} ${e.event_type}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, query, result]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search member, number, phone…"
            className="pl-8"
          />
        </div>
        <Select value={result} onValueChange={(v) => v && setResult(v)}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by result">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No auth events"
          description="No authentication events match your filters."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>Member</TableHead>
                <TableHead className="w-[160px]">Event</TableHead>
                <TableHead className="w-[170px] text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const ok = e.result === "success";
                const m = e.members;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-block size-2.5 rounded-full",
                          ok
                            ? "bg-[var(--color-pine)]"
                            : "bg-[var(--color-red)]",
                        )}
                        title={ok ? "Success" : "Failure"}
                      />
                    </TableCell>
                    <TableCell>
                      {m ? (
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            first={m.first_name}
                            last={m.last_name}
                            seed={m.member_number}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {m.first_name} {m.last_name}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {m.member_number} · {m.phone}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Unidentified caller
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          ok
                            ? "bg-[var(--color-pine)]/12 text-[var(--color-pine)]"
                            : "bg-[var(--color-red)]/12 text-[var(--color-red)]"
                        }
                      >
                        {e.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatEventTime(e.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
