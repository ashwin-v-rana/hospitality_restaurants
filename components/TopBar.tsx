"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound } from "lucide-react";
import { RestaurantSwitcher } from "@/components/RestaurantSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { Avatar } from "@/components/Avatar";
import type { Restaurant } from "@/lib/queries";

const TITLES: { match: (p: string) => boolean; title: string }[] = [
  { match: (p) => p === "/", title: "Dashboard" },
  { match: (p) => p.startsWith("/availability"), title: "Availability" },
  { match: (p) => p.startsWith("/reservations"), title: "Reservations" },
  { match: (p) => p.startsWith("/members"), title: "Members" },
  { match: (p) => p.startsWith("/admin/agents"), title: "Agents" },
];

export function TopBar({
  agent,
  restaurants,
  selectedId,
}: {
  agent: { full_name: string | null; role: string };
  restaurants: Restaurant[];
  selectedId: string | null;
}) {
  const pathname = usePathname();
  const title = TITLES.find((t) => t.match(pathname))?.title ?? "Console";
  const name = agent.full_name ?? "Agent";

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-[var(--sidebar)] px-4 backdrop-blur-xl sm:px-6">
      <h1 className="font-display text-2xl font-medium text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="status-dot size-1.5 animate-soft-pulse rounded-full bg-[var(--color-pine)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent-deep)]">
            Console Sync
          </span>
        </div>

        <RestaurantSwitcher restaurants={restaurants} selectedId={selectedId} />

        <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold text-foreground">{name}</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {agent.role}
            </div>
          </div>
          <Avatar
            first={name.split(" ")[0]}
            last={name.split(" ")[1] ?? ""}
            seed={name}
          />
        </div>

        <Link
          href="/change-password"
          title="Change password"
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <KeyRound className="size-4" />
        </Link>
        <SignOutButton />
      </div>
    </header>
  );
}
