"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarSearch,
  LayoutDashboard,
  BookMarked,
  Users,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/availability", label: "Availability", icon: CalendarSearch },
  { href: "/reservations", label: "Reservations", icon: BookMarked },
  { href: "/members", label: "Members", icon: Users },
  { href: "/activity", label: "Auth & Activity", icon: Activity },
];

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...baseLinks, { href: "/admin/agents", label: "Agents", icon: ShieldCheck }]
    : baseLinks;

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-[var(--sidebar)] backdrop-blur-xl md:flex">
      <div className="border-b border-border px-5 pb-5 pt-5">
        <Link href="/" aria-label="The Ned — Cecconi's home" className="block">
          <Image
            src="/thened-cecconis-logo.svg"
            alt="The Ned — Cecconi's"
            width={194}
            height={74}
            priority
            className="h-12 w-auto"
          />
        </Link>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent-deep)]">
          Reservations Console
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 py-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 border-l-[3px] px-5 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary bg-gradient-to-r from-primary/12 to-transparent font-semibold text-[var(--accent-deep)]"
                  : "border-transparent font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="status-dot size-2 rounded-full bg-[var(--color-pine)]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent-deep)]">
            Console Live
          </span>
        </div>
      </div>
    </aside>
  );
}
