"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useFormState, useFormStatus } from "react-dom";
import { superadminLogin } from "@/app/actions/superadmin";

const initialState: { error?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function SuperadminLoginForm() {
  const [state, formAction] = useFormState(superadminLogin, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="superadmin-email">Email</Label>
        <Input id="superadmin-email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="superadmin-password">Password</Label>
        <Input
          id="superadmin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
