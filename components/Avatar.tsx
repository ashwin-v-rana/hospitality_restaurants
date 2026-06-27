import { cn } from "@/lib/utils";

// Deterministic warm palette so a given member always gets the same colour.
const PALETTE = [
  "bg-amber-100 text-amber-900",
  "bg-rose-100 text-rose-900",
  "bg-emerald-100 text-emerald-900",
  "bg-sky-100 text-sky-900",
  "bg-violet-100 text-violet-900",
  "bg-orange-100 text-orange-900",
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function initials(first?: string | null, last?: string | null): string {
  const a = first?.trim()?.[0] ?? "";
  const b = last?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export function Avatar({
  first,
  last,
  seed,
  className,
}: {
  first?: string | null;
  last?: string | null;
  /** Stable colour key; defaults to the name. */
  seed?: string;
  className?: string;
}) {
  const color = PALETTE[hash(seed ?? `${first}${last}`) % PALETTE.length];
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold",
        color,
        className,
      )}
      aria-hidden
    >
      {initials(first, last)}
    </span>
  );
}
