"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import {
  createAgentAction,
  updateAgentAction,
  resetAgentPasswordAction,
  deleteAgentAction,
  assignRestaurantAction,
  type AdminActionResult,
} from "@/app/(app)/admin/agents/actions";
import type { AdminAgent, Restaurant } from "@/lib/queries";

const ROLES = ["host", "manager", "admin"] as const;

function roleBadgeClass(role: string): string {
  if (role === "admin") return "bg-[var(--color-sky)]/12 text-[var(--color-sky)]";
  if (role === "manager") return "bg-[var(--color-green)]/12 text-[var(--color-green)]";
  return "bg-muted text-muted-foreground";
}

export function AgentsManager({
  agents,
  restaurants,
  currentAgentId,
}: {
  agents: AdminAgent[];
  restaurants: Restaurant[];
  currentAgentId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAgent | null>(null);
  const [resetting, setResetting] = useState<AdminAgent | null>(null);
  const [deleting, setDeleting] = useState<AdminAgent | null>(null);

  function run(key: string, fn: () => Promise<AdminActionResult>, ok: string) {
    setBusy(key);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error("Action failed", { description: result.message });
      }
      setBusy(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add agent
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="w-[110px]">Role</TableHead>
              <TableHead>Restaurants</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[150px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((a) => {
              const isSelf = a.id === currentAgentId;
              const assigned = new Set(
                a.agent_restaurants.map((l) => l.restaurant_id),
              );
              return (
                <TableRow key={a.id} className={a.is_active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        first={a.full_name?.split(" ")[0] ?? a.email}
                        last={a.full_name?.split(" ")[1] ?? ""}
                        seed={a.id}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {a.full_name ?? "—"}
                          {isSelf ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              (you)
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {a.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("capitalize", roleBadgeClass(a.role))}
                    >
                      {a.role}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {restaurants.map((r) => {
                        const on = assigned.has(r.id);
                        const key = `${a.id}:rest:${r.id}`;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={busy === key}
                            onClick={() =>
                              run(
                                key,
                                () => assignRestaurantAction(a.id, r.id, !on),
                                on ? "Restaurant unassigned" : "Restaurant assigned",
                              )
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50",
                              on
                                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                                : "border-dashed text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        a.is_active
                          ? "bg-[var(--color-green)]/12 text-[var(--color-green)]"
                          : "text-muted-foreground"
                      }
                    >
                      {a.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => setEditing(a)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reset password"
                        onClick={() => setResetting(a)}
                      >
                        <KeyRound className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                        disabled={isSelf}
                        onClick={() => setDeleting(a)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AddAgentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => router.refresh()}
      />
      <EditAgentDialog
        agent={editing}
        isSelf={editing?.id === currentAgentId}
        onOpenChange={(o) => !o && setEditing(null)}
        onDone={() => router.refresh()}
      />
      <ResetPasswordDialog
        agent={resetting}
        onOpenChange={(o) => !o && setResetting(null)}
        onDone={() => router.refresh()}
      />
      <DeleteAgentDialog
        agent={deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

function AddAgentDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("host");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setEmail("");
    setFullName("");
    setRole("host");
    setPassword("");
  }

  const canSave =
    email.includes("@") && fullName.trim().length > 0 && password.length >= 8;

  function submit() {
    startTransition(async () => {
      const result = await createAgentAction({ email, fullName, role, password });
      if (result.ok) {
        toast.success("Agent created", {
          description: "They must change this password on first login.",
        });
        reset();
        onOpenChange(false);
        onDone();
      } else {
        toast.error("Could not create agent", { description: result.message });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add agent</DialogTitle>
          <DialogDescription>
            Creates a login with a temporary password. The agent is added to the
            selected restaurant and must change the password on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ag-email">Email</Label>
            <Input
              id="ag-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="new.host@thened-demo.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ag-name">Full name</Label>
            <Input
              id="ag-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v)}>
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ag-pw">Temp password</Label>
              <Input
                id="ag-pw"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 chars"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !canSave}>
            {pending ? "Creating…" : "Create agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAgentDialog({
  agent,
  isSelf,
  onOpenChange,
  onDone,
}: {
  agent: AdminAgent | null;
  isSelf: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("host");
  const [isActive, setIsActive] = useState(true);
  const [pending, startTransition] = useTransition();
  const [seeded, setSeeded] = useState<string | null>(null);

  // Seed from the agent when the dialog opens for a new target.
  if (agent && seeded !== agent.id) {
    setSeeded(agent.id);
    setFullName(agent.full_name ?? "");
    setRole(agent.role);
    setIsActive(agent.is_active);
  }
  if (!agent && seeded !== null) setSeeded(null);

  function submit() {
    if (!agent) return;
    startTransition(async () => {
      const result = await updateAgentAction(agent.id, {
        fullName,
        role,
        isActive,
      });
      if (result.ok) {
        toast.success("Agent updated");
        onOpenChange(false);
        onDone();
      } else {
        toast.error("Could not update agent", { description: result.message });
      }
    });
  }

  return (
    <Dialog open={agent !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit agent</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{agent?.email}</span>{" "}
            <span className="text-muted-foreground">(email isn&apos;t editable)</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ed-name">Full name</Label>
            <Input
              id="ed-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => v && setRole(v)}
                disabled={isSelf}
              >
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSelf ? (
                <p className="text-[11px] text-muted-foreground">
                  Can&apos;t change your own role
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isSelf}
                onClick={() => setIsActive((v) => !v)}
              >
                {isActive ? "Active" : "Inactive"}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  agent,
  onOpenChange,
  onDone,
}: {
  agent: AdminAgent | null;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!agent) return;
    startTransition(async () => {
      const result = await resetAgentPasswordAction(agent.id, password);
      if (result.ok) {
        toast.success("Password reset", {
          description: "The agent must change it on next login.",
        });
        setPassword("");
        onOpenChange(false);
        onDone();
      } else {
        toast.error("Could not reset password", { description: result.message });
      }
    });
  }

  return (
    <Dialog open={agent !== null} onOpenChange={(o) => { if (!o) setPassword(""); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a temporary password for{" "}
            <span className="font-medium text-foreground">{agent?.full_name}</span>.
            They&apos;ll be required to change it on next login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rp-pw">Temporary password</Label>
          <Input
            id="rp-pw"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 chars"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || password.length < 8}>
            {pending ? "Resetting…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAgentDialog({
  agent,
  onOpenChange,
  onDone,
}: {
  agent: AdminAgent | null;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  const target = agent?.full_name ?? agent?.email ?? "";
  const canDelete = confirm.trim() === target && target.length > 0;

  function submit() {
    if (!agent || !canDelete) return;
    startTransition(async () => {
      const result = await deleteAgentAction(agent.id);
      if (result.ok) {
        toast.success("Agent deleted");
        setConfirm("");
        onOpenChange(false);
        onDone();
      } else {
        toast.error("Could not delete agent", { description: result.message });
      }
    });
  }

  return (
    <Dialog open={agent !== null} onOpenChange={(o) => { if (!o) setConfirm(""); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete agent</DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <span className="font-medium text-foreground">{target}</span> and their
            restaurant access. Type the name to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="del-confirm">
            Type <span className="font-medium text-foreground">{target}</span>
          </Label>
          <Input
            id="del-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={target}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={submit}
            disabled={pending || !canDelete}
          >
            {pending ? "Deleting…" : "Delete agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
