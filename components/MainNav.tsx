"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarSearch,
  LayoutDashboard,
  BookMarked,
  Users,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/availability", label: "Availability", icon: CalendarSearch },
  { href: "/reservations", label: "Reservations", icon: BookMarked },
  { href: "/members", label: "Members", icon: Users },
];

export function MainNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...baseLinks, { href: "/admin/agents", label: "Agents", icon: ShieldCheck }]
    : baseLinks;

  return (
    <nav className="flex items-center gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
