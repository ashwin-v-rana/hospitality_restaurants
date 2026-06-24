"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function DatePicker({
  date,
  label = "Date",
}: {
  date: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="resv-date">{label}</Label>
      <Input
        id="resv-date"
        type="date"
        value={date}
        onChange={(e) => update(e.target.value)}
        className="w-[180px]"
      />
    </div>
  );
}
