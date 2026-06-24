"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchMembersAction } from "@/app/(app)/actions";
import type { Member } from "@/lib/queries";

export function MemberCombobox({
  value,
  onSelect,
}: {
  value: Member | null;
  onSelect: (member: Member | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, startTransition] = useTransition();

  // Debounced search whenever the popover is open and the term changes.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      startTransition(async () => {
        const results = await searchMembersAction(term);
        setMembers(results);
      });
    }, 200);
    return () => clearTimeout(id);
  }, [term, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          />
        }
      >
        {value ? (
          <span className="flex items-center gap-2 truncate">
            <User className="size-4 text-muted-foreground" />
            {value.first_name} {value.last_name}
            <span className="font-mono text-xs text-muted-foreground">
              {value.member_number}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Search members…</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        className="w-(--anchor-width) min-w-[260px] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Name, member number, or phone…"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList>
            {pending ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </div>
            ) : (
              <>
                <CommandEmpty>No members found.</CommandEmpty>
                <CommandGroup>
                  {members.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.id}
                      onSelect={() => {
                        onSelect(m);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          value?.id === m.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="flex flex-1 items-center justify-between gap-2">
                        <span>
                          {m.first_name} {m.last_name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {m.member_number}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
