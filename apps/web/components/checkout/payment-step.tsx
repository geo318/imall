"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import Image from "next/image";
import { CreditCard, Shield } from "lucide-react";
import { useTranslations } from "@/i18n/provider";
import type { CheckoutPaymentMethod, InstallmentProvider } from "./types";

const INSTALLMENT_PROVIDER_LOGOS: Record<InstallmentProvider, string> = {
  credo: "/credo-bank-logo.png",
  crystal: "/crystal-bank-logo.png",
};

type PaymentStepProps = {
  paymentMethod: CheckoutPaymentMethod;
  onPaymentMethodChange: (method: CheckoutPaymentMethod) => void;
  installmentProvider: InstallmentProvider;
  onInstallmentProviderChange: (provider: InstallmentProvider) => void;
  onlineInstallmentsAllowed: boolean;
  onBack: () => void;
  onSubmit: () => Promise<void> | void;
  submitting: boolean;
  checkingStatus: boolean;
};

export function PaymentStep({
  paymentMethod,
  onPaymentMethodChange,
  installmentProvider,
  onInstallmentProviderChange,
  onlineInstallmentsAllowed,
  onBack,
  onSubmit,
  submitting,
  checkingStatus,
}: PaymentStepProps) {
  const t = useTranslations();

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">{t("checkout.payment.title")}</h2>
      </div>

      <div className="space-y-3 mb-6">
        {(["card", "paypal", "installments"] as const).map((method) => (
          <div
            key={method}
            className="flex items-center space-x-3 p-4 border border-slate-200 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-colors"
          >
            <input
              type="radio"
              id={method}
              name="payment"
              value={method}
              checked={paymentMethod === method}
              onChange={() => onPaymentMethodChange(method)}
              className="h-4 w-4 text-emerald-600"
            />
            <Label htmlFor={method} className="flex-1 cursor-pointer">
              {method === "card"
                ? t("checkout.payment.card")
                : method === "paypal"
                  ? t("checkout.payment.paypal")
                  : t("checkout.payment.installments")}
            </Label>
          </div>
        ))}
      </div>

      {paymentMethod === "card" ? (
        <div className="space-y-4 mb-6">
          <div className="space-y-2">
            <Label htmlFor="cardNumber">{t("checkout.payment.cardNumber")}</Label>
            <Input id="cardNumber" placeholder={t("checkout.payment.cardNumberPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiry">{t("checkout.payment.expiry")}</Label>
              <Input id="expiry" placeholder={t("checkout.payment.expiryPlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cvc">CVC</Label>
              <Input id="cvc" placeholder="123" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cardName">{t("checkout.payment.cardName")}</Label>
            <Input id="cardName" placeholder={t("checkout.payment.cardNamePlaceholder")} />
          </div>
        </div>
      ) : null}

      {paymentMethod === "installments" ? (
        <div className="mb-6 space-y-3">
          <p className="text-sm font-medium text-slate-700">
            {t("checkout.payment.installmentProviderLabel")}
          </p>
          {!onlineInstallmentsAllowed ? (
            <p className="text-xs text-amber-700">
              {t("checkout.payment.onlineInstallmentsMultiVendorHint")}
            </p>
          ) : null}
          {(["credo", "crystal"] as const).map((provider) => (
            <label
              key={provider}
              htmlFor={`installment-provider-${provider}`}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                provider === "credo" && !onlineInstallmentsAllowed
                  ? "cursor-not-allowed opacity-55"
                  : "cursor-pointer"
              } ${
                installmentProvider === provider
                  ? "border-emerald-500 bg-emerald-50/60"
                  : "border-slate-200 hover:border-emerald-300"
              }`}
            >
              <input
                id={`installment-provider-${provider}`}
                type="radio"
                name="installmentProvider"
                value={provider}
                checked={installmentProvider === provider}
                onChange={() => {
                  if (provider === "credo" && !onlineInstallmentsAllowed) {
                    return;
                  }
                  onInstallmentProviderChange(provider);
                }}
                disabled={provider === "credo" && !onlineInstallmentsAllowed}
                className="h-4 w-4 text-emerald-600"
              />
              <Image
                src={INSTALLMENT_PROVIDER_LOGOS[provider]}
                alt={
                  provider === "credo"
                    ? t("checkout.payment.credoLogoAlt")
                    : t("checkout.payment.crystalLogoAlt")
                }
                width={120}
                height={28}
                className="h-7 w-auto"
              />
              <span className="text-sm text-slate-700">
                {provider === "credo"
                  ? t("checkout.payment.credoProvider")
                  : t("checkout.payment.crystalProvider")}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
        <Shield className="h-4 w-4" />
        <span>{t("checkout.payment.secureNote")}</span>
      </div>

      <div className="flex gap-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          {t("checkout.actions.back")}
        </Button>
        <Button
          onClick={() => void onSubmit()}
          className="flex-1"
          size="lg"
          disabled={submitting || checkingStatus}
        >
          {submitting
            ? t("checkout.actions.processing")
            : paymentMethod === "installments"
              ? t("checkout.actions.goToInstallments")
              : t("checkout.actions.placeOrder")}
        </Button>
      </div>
    </div>
  );
}
