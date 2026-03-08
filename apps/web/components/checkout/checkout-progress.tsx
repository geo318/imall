"use client";

import { Check } from "lucide-react";
import { useTranslations } from "@/i18n/provider";
import type { CheckoutStep } from "./types";

type CheckoutProgressProps = {
  step: CheckoutStep;
};

export function CheckoutProgress({ step }: CheckoutProgressProps) {
  const t = useTranslations();

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-emerald-600 text-white">
          {step === "shipping" ? "1" : <Check className="h-4 w-4" />}
        </div>
        <span className="font-medium">{t("checkout.steps.shipping")}</span>
      </div>
      <div className="flex-1 h-px bg-slate-200" />
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === "payment" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
          }`}
        >
          2
        </div>
        <span className={step === "payment" ? "font-medium" : "text-slate-600"}>
          {t("checkout.steps.payment")}
        </span>
      </div>
    </div>
  );
}
