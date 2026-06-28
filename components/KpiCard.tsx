type Accent = "rust" | "pine" | "gold" | "amber" | "ink";

const ACCENT: Record<Accent, { color: string; tint: string }> = {
  rust: { color: "#b65433", tint: "rgba(182, 84, 51, 0.14)" },
  pine: { color: "#17403b", tint: "rgba(23, 64, 59, 0.12)" },
  gold: { color: "#b88a3a", tint: "rgba(184, 138, 58, 0.16)" },
  amber: { color: "#c07b2c", tint: "rgba(192, 123, 44, 0.16)" },
  ink: { color: "#1b2230", tint: "rgba(27, 34, 48, 0.08)" },
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "rust",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: Accent;
}) {
  const { color, tint } = ACCENT[accent];
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full"
        style={{ background: `radial-gradient(circle, ${tint}, transparent 70%)` }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent-deep)]">
          {label}
        </span>
        <Icon className="size-4" style={{ color }} />
      </div>
      <div className="mt-2 font-display text-4xl font-medium tabular-nums text-[var(--color-ink)]">
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
