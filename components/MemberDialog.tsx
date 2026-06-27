"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createMemberAction,
  updateMemberAction,
} from "@/app/(app)/members/actions";
import { E164_REGEX } from "@/lib/constants";
import type { Member } from "@/lib/queries";

export function MemberDialog({
  open,
  mode,
  member,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  member?: Member | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (member: Member) => void;
}) {
  // Seeded from props at mount; the parent passes a changing `key` so the
  // dialog remounts (fresh state) each time it's opened for a member.
  const [firstName, setFirstName] = useState(member?.first_name ?? "");
  const [lastName, setLastName] = useState(member?.last_name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [pending, startTransition] = useTransition();

  const phoneValid = E164_REGEX.test(phone.trim());
  const canSave =
    firstName.trim().length > 0 && lastName.trim().length > 0 && phoneValid;

  function submit() {
    if (!canSave) return;
    const input = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createMemberAction(input)
          : await updateMemberAction(member!.id, input);

      if (result.ok) {
        toast.success(
          mode === "create" ? "Member added" : "Member updated",
          {
            description:
              mode === "create"
                ? `${result.member.first_name} ${result.member.last_name} · ${result.member.member_number}`
                : undefined,
          },
        );
        onSaved?.(result.member);
        onOpenChange(false);
      } else {
        toast.error(
          mode === "create" ? "Could not add member" : "Could not update member",
          { description: result.message },
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add member" : "Edit member"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a member to attach to bookings. A NED- number is assigned automatically."
              : "Update this member's details. The NED- number can't change."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "edit" && member ? (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Member number{" "}
              <span className="font-mono text-foreground">
                {member.member_number}
              </span>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="first">First name</Label>
              <Input
                id="first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last">Last name</Label>
              <Input
                id="last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+442079460123"
              aria-invalid={phone.length > 0 && !phoneValid}
            />
            <p className="text-xs text-muted-foreground">
              E.164 format — include the country code with{" "}
              <span className="font-mono">+</span>. 11–15 digits.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !canSave}>
            {pending
              ? "Saving…"
              : mode === "create"
                ? "Add member"
                : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
