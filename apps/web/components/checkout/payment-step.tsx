"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { AlertCircle, CreditCard, Shield } from "lucide-react";
import Image from "next/image";
import { useId } from "react";
import { useTranslations } from "@/i18n/provider";
import type { CheckoutPaymentMethod, InstallmentProvider } from "./types";

const INSTALLMENT_PROVIDER_LOGOS: Partial<Record<InstallmentProvider, string>> = {
  credo: "/credo-bank-logo.png",
  crystal: "/crystal-bank-logo.png",
};

type PaymentStepProps = {
  paymentMethod: CheckoutPaymentMethod;
  onPaymentMethodChange: (method: CheckoutPaymentMethod) => void;
  installmentProvider: InstallmentProvider;
  onInstallmentProviderChange: (provider: InstallmentProvider) => void;
  keepzPersonalNumber: string;
  onKeepzPersonalNumberChange: (value: string) => void;
  onlineInstallmentsAllowed: boolean;
  onBack: () => void;
  onSubmit: () => Promise<void> | void;
  onlineLaunchForm: {
    action: string;
    fields: Record<string, string>;
    ready: boolean;
    provider: "credo" | "keepz";
    reason: "missingCart" | "missingCustomerData" | "missingKeepzPersonalNumber" | null;
  };
  submitting: boolean;
};

export function PaymentStep({
  paymentMethod,
  onPaymentMethodChange,
  installmentProvider,
  onInstallmentProviderChange,
  keepzPersonalNumber,
  onKeepzPersonalNumberChange,
  onlineInstallmentsAllowed,
  onBack,
  onSubmit,
  onlineLaunchForm,
  submitting,
}: PaymentStepProps) {
  const t = useTranslations();
  const onlineFormId = useId();

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
        onlineInstallmentsAllowed ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            {t("checkout.payment.keepzCardHint")}
          </div>
        ) : (
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
        )
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
          {(["keepz", "credo"] as const).map((provider) => (
            <label
              key={provider}
              htmlFor={`installment-provider-${provider}`}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                (provider === "credo" || provider === "keepz") && !onlineInstallmentsAllowed
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
                  if (
                    (provider === "credo" || provider === "keepz") &&
                    !onlineInstallmentsAllowed
                  ) {
                    return;
                  }
                  onInstallmentProviderChange(provider);
                }}
                disabled={
                  (provider === "credo" || provider === "keepz") && !onlineInstallmentsAllowed
                }
                className="h-4 w-4 text-emerald-600"
              />
              {INSTALLMENT_PROVIDER_LOGOS[provider] ? (
                <Image
                  src={INSTALLMENT_PROVIDER_LOGOS[provider]}
                  alt={
                    provider === "credo"
                      ? t("checkout.payment.credoLogoAlt")
                      : provider === "keepz"
                        ? t("checkout.payment.keepzLogoAlt")
                        : t("checkout.payment.crystalLogoAlt")
                  }
                  width={120}
                  height={28}
                  className="h-7 w-auto"
                />
              ) : (
                <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Keepz
                </span>
              )}
              <span className="text-sm text-slate-700">
                {provider === "credo"
                  ? t("checkout.payment.credoProvider")
                  : provider === "keepz"
                    ? t("checkout.payment.keepzProvider")
                    : t("checkout.payment.crystalProvider")}
              </span>
            </label>
          ))}
          {installmentProvider === "keepz" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="space-y-2">
                <Label htmlFor="keepz-personal-number">
                  {t("checkout.payment.keepzPersonalNumber")}
                </Label>
                <Input
                  id="keepz-personal-number"
                  value={keepzPersonalNumber}
                  onChange={(event) => onKeepzPersonalNumberChange(event.target.value)}
                  placeholder={t("checkout.payment.keepzPersonalNumberPlaceholder")}
                />
                <p className="text-xs text-slate-500">
                  {t("checkout.payment.keepzPersonalNumberHint")}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
        <Shield className="h-4 w-4" />
        <span>{t("checkout.payment.secureNote")}</span>
      </div>

      <form
        id={onlineFormId}
        action={onlineLaunchForm.action}
        method="GET"
        className="hidden"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        {Object.entries(onlineLaunchForm.fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
      </form>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button variant="outline" onClick={onBack} className="w-full sm:flex-1">
          {t("checkout.actions.back")}
        </Button>
        {paymentMethod === "installments" &&
        (installmentProvider === "credo" || installmentProvider === "keepz") ? (
          <button
            type="submit"
            form={onlineFormId}
            name="mode"
            value="server-form"
            className={
              installmentProvider === "credo"
                ? "flex w-full items-center justify-center rounded-lg bg-[#006393] p-[18px] text-[14px] font-tbcx-bold text-white outline-none transition-all hover:bg-[#006393]/90 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
                : "flex w-full items-center justify-center rounded-lg bg-emerald-600 p-[18px] text-[14px] font-semibold text-white outline-none transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
            }
            disabled={submitting}
          >
            {installmentProvider === "credo" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="mr-2"
                aria-hidden="true"
              >
                <path
                  d="M18.9977 17.242L18.1247 16.8065C17.9468 16.7097 17.769 16.6129 17.5912 16.5C19.1595 14.6936 20.0001 12.4193 20.0001 9.99998C20.0001 4.4839 15.5054 1.90735e-06 9.97603 1.90735e-06C8.73107 1.90735e-06 7.51847 0.225784 6.38672 0.661263V2.29033V2.46774C7.50234 1.93551 8.73107 1.66125 9.97603 1.66125C14.5839 1.66125 18.3187 5.40323 18.3187 9.98389C18.3187 11.9517 17.6397 13.8226 16.3947 15.3065C16.2815 15.129 16.1684 14.9516 16.0713 14.7581L15.6348 13.8871C15.4084 13.4355 14.7132 13.5968 14.7132 14.0968V17.6452C14.7132 17.9032 14.9234 18.1291 15.1982 18.1291H18.7552C19.2888 18.1452 19.4504 17.4677 18.9977 17.242Z"
                  fill="white"
                />
                <path
                  d="M9.95922 3.35467C8.64964 3.35467 7.42081 3.74177 6.38615 4.38694V5.85469C6.38615 6.77402 5.65857 7.48376 4.73692 7.48376C4.42973 7.48376 4.12255 7.4031 3.88009 7.24178C3.49206 8.08045 3.26562 9.03206 3.26562 10.016C3.26562 13.6934 6.2568 16.6772 9.95922 16.6772C11.285 16.6772 12.5299 16.2901 13.5809 15.6128V14.1128C13.5809 13.1934 14.3084 12.4837 15.23 12.4837C15.5372 12.4837 15.8283 12.5644 16.087 12.7257C16.4588 11.9031 16.669 10.9838 16.669 10.016C16.669 6.33854 13.6617 3.35467 9.95922 3.35467Z"
                  fill="white"
                />
                <path
                  d="M9.99186 18.3226C5.38402 18.3226 1.64913 14.5806 1.64913 9.99992C1.64913 9.82251 1.64913 9.6451 1.66536 9.46769C1.66536 9.41932 1.66536 9.37094 1.68149 9.32257C1.69772 9.17734 1.71385 9.04831 1.72998 8.90318C1.72998 8.8709 1.74621 8.83861 1.74621 8.79024C1.90782 7.67741 2.29586 6.62895 2.86173 5.69353V5.67733C3.07193 5.32252 3.33062 4.98379 3.58931 4.66126C3.70253 4.83867 3.81564 5.01608 3.91272 5.19348L4.34925 6.06444C4.57558 6.51611 5.2708 6.35479 5.2708 5.85474V2.30636C5.2708 2.04829 5.0606 1.82251 4.78578 1.82251H1.22883C0.711452 1.82251 0.549744 2.51605 1.01863 2.74184L1.89169 3.17731C2.08566 3.27417 2.2636 3.37092 2.4252 3.49995C1.85933 4.16121 1.37431 4.88704 1.0024 5.67733V5.69353C0.808435 6.11281 0.630598 6.5322 0.485123 6.98387C0.46889 7.03224 0.452761 7.08062 0.436528 7.14508C0.388036 7.32249 0.339545 7.5 0.291053 7.67741C0.274924 7.72579 0.274924 7.77416 0.258691 7.80645C0.210199 8.01604 0.161708 8.24192 0.129345 8.45162C0.113216 8.49999 0.113216 8.56446 0.113216 8.61283C0.0808539 8.79024 0.0647246 8.95156 0.0484918 9.12897C0.0484918 9.19353 0.0323626 9.258 0.0323626 9.32257C0.0162332 9.54835 0 9.77414 0 9.99992C0 15.5161 4.49473 20 10.0242 20C11.2853 20 12.4979 19.758 13.6135 19.3386V17.6774V17.5C12.4979 18.0161 11.2691 18.3226 9.99186 18.3226Z"
                  fill="white"
                />
              </svg>
            ) : null}
            {submitting
              ? t("checkout.actions.processing")
              : installmentProvider === "keepz"
                ? t("checkout.actions.keepzInstallments")
                : t("checkout.actions.credoInstallments")}
          </button>
        ) : (
          <Button
            onClick={() => void onSubmit()}
            className="w-full sm:flex-1"
            size="lg"
            disabled={submitting}
          >
            {submitting
              ? t("checkout.actions.processing")
              : paymentMethod === "card" && onlineInstallmentsAllowed
                ? t("checkout.actions.keepzCard")
                : paymentMethod === "installments"
                  ? t("checkout.actions.goToInstallments")
                  : t("checkout.actions.placeOrder")}
          </Button>
        )}
      </div>
      {paymentMethod === "installments" &&
      (installmentProvider === "credo" || installmentProvider === "keepz") &&
      !onlineLaunchForm.ready ? (
        <div className="mt-3 flex items-start gap-2 text-sm text-amber-700" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {onlineLaunchForm.reason === "missingCart"
              ? t("checkout.installments.missingCart")
              : onlineLaunchForm.reason === "missingKeepzPersonalNumber"
                ? t("checkout.installments.missingKeepzPersonalNumber")
                : t("checkout.installments.missingCredoData")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
