"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CoverPoint = { label: string; covers: number };

export function CoversChart({ data }: { data: CoverPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No covers booked today yet.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(27,34,48,0.08)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6b6355" }}
          tickLine={false}
          axisLine={{ stroke: "rgba(27,34,48,0.12)" }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#6b6355" }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          cursor={{ fill: "rgba(182,84,51,0.06)" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgba(27,34,48,0.12)",
            background: "#fffaf5",
            fontSize: 12,
          }}
          labelStyle={{ color: "#1b2230", fontWeight: 600 }}
        />
        <Bar dataKey="covers" radius={[6, 6, 0, 0]} maxBarSize={42}>
          {data.map((_, i) => (
            <Cell key={i} fill="#b65433" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
