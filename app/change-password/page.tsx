"use client";

import Image from "next/image";
import { useActionState } from "react";
import {
  changePassword,
  type ChangePasswordState,
} from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialState: ChangePasswordState = { error: null };

export default function ChangePasswordPage() {
  const [state, formAction, pending] = useActionState(
    changePassword,
    initialState,
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-3 text-center">
          <Image
            src="/thened-cecconis-logo.svg"
            alt="The Ned — Cecconi's"
            width={194}
            height={74}
            priority
            className="mx-auto h-16 w-auto"
          />
          <CardTitle className="font-display text-2xl font-medium">
            Set a new password
          </CardTitle>
          <CardDescription>
            Choose a new password to continue to the console.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input
                id="next"
                name="next"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            {state.error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Saving…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
