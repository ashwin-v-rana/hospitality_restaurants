"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth-actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      className="text-muted-foreground"
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
