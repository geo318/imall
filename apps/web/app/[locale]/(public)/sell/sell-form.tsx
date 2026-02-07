"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useFormState, useFormStatus } from "react-dom";
import { registerShop } from "@/app/actions/shops";
import { useTranslations } from "@/i18n/provider";


function SubmitButton() {
  const t = useTranslations();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t("sell.creating") : t("sell.create")}
    </Button>
  );
}

export function SellForm() {
  const t = useTranslations();
  const [state, formAction] = useFormState(registerShop, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="shop-name">{t("sell.nameLabel")}</Label>
        <Input id="shop-name" name="name" placeholder={t("sell.namePlaceholder")} required />
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <div className="text-xs text-slate-500">{t("sell.notice")}</div>
      <SubmitButton />
    </form>
  );
}
