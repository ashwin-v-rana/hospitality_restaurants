"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setSelectedRestaurant } from "@/app/(app)/restaurant-actions";
import type { Restaurant } from "@/lib/queries";

export function RestaurantSwitcher({
  restaurants,
  selectedId,
}: {
  restaurants: Restaurant[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (restaurants.length === 0) return null;

  function onChange(value: string | null) {
    if (!value) return;
    startTransition(async () => {
      await setSelectedRestaurant(value);
      router.refresh();
    });
  }

  // A single assigned restaurant: show it as a static label, not a dropdown.
  if (restaurants.length === 1) {
    const r = restaurants[0];
    return (
      <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="font-medium">{r.name}</span>
      </div>
    );
  }

  return (
    <Select
      value={selectedId ?? undefined}
      onValueChange={onChange}
      disabled={pending}
    >
      <SelectTrigger className="w-[240px]" aria-label="Select restaurant">
        <Building2 className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Select a restaurant" />
      </SelectTrigger>
      <SelectContent>
        {restaurants.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
