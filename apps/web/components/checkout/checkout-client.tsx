"use client";

import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import { CheckoutConfirmation } from "./checkout-confirmation";
import { CheckoutInstallmentBanner } from "./checkout-installment-banner";
import { CheckoutProgress } from "./checkout-progress";
import { CheckoutSkeleton } from "./checkout-skeleton";
import { OrderSummary } from "./order-summary";
import { PaymentStep } from "./payment-step";
import { ShippingStep } from "./shipping-step";
import type { CheckoutPaymentMethod, InstallmentProvider } from "./types";
import { useCheckoutController } from "./use-checkout-controller";

type CheckoutClientProps = {
  cartKey: string;
  continueShoppingHref: string;
};

export function CheckoutClient({ cartKey, continueShoppingHref }: CheckoutClientProps) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const requestedPayment = searchParams.get("payment");
  const requestedProvider = searchParams.get("provider");
  const installmentLaunchError = searchParams.get("installment_error");
  const initialPaymentMethod: CheckoutPaymentMethod =
    requestedPayment === "installments" ? "installments" : "card";
  const initialInstallmentProvider: InstallmentProvider =
    requestedProvider === "crystal" ? "crystal" : "credo";
  const checkout = useCheckoutController({
    cartKey,
    initialPaymentMethod,
    initialInstallmentProvider,
  });

  if (checkout.loading) {
    return <CheckoutSkeleton label={t("checkout.loading")} />;
  }

  if (checkout.step === "confirmation") {
    return <CheckoutConfirmation continueShoppingHref={continueShoppingHref} />;
  }

  return (
    <div className="bg-slate-50">
      <div className="container py-8 md:py-12">
        <Link
          href="/cart"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("checkout.backToCart")}
        </Link>

        <CheckoutInstallmentBanner
          pendingOrderCode={checkout.pendingOrderCode}
          pendingRedirectUrl={checkout.pendingRedirectUrl}
          statusMessage={checkout.statusMessage}
          checkingStatus={checkout.checkingStatus}
          submitting={checkout.submitting}
          onSyncStatus={checkout.syncInstallmentStatus}
          onClear={checkout.clearInstallmentState}
        />

        {checkout.errorMessage || installmentLaunchError ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {checkout.errorMessage || installmentLaunchError}
          </div>
        ) : null}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <CheckoutProgress step={checkout.step} />

            {checkout.step === "shipping" ? (
              <ShippingStep
                shippingForm={checkout.shippingForm}
                onShippingFieldChange={checkout.handleShippingFieldChange}
                savedAddresses={checkout.savedAddresses}
                addressesLoading={checkout.addressesLoading}
                selectedAddressId={checkout.selectedAddressId}
                onApplySavedAddress={checkout.applySavedAddress}
                addressMessage={checkout.addressMessage}
                addressActionPending={checkout.addressActionPending}
                saveAddressDisabled={checkout.saveAddressDisabled}
                submitting={checkout.submitting}
                onSaveAddress={() => checkout.persistCurrentAddress({ manual: true })}
                onContinue={checkout.handleContinue}
              />
            ) : null}

            {checkout.step === "payment" ? (
              <PaymentStep
                paymentMethod={checkout.paymentMethod}
                onPaymentMethodChange={checkout.setPaymentMethod}
                installmentProvider={checkout.installmentProvider}
                onInstallmentProviderChange={checkout.setInstallmentProvider}
                onlineInstallmentsAllowed={checkout.onlineInstallmentsAllowed}
                onBack={() => checkout.setStep("shipping")}
                onSubmit={checkout.handleContinue}
                credoLaunchForm={checkout.credoLaunchForm}
                submitting={checkout.submitting}
                checkingStatus={checkout.checkingStatus}
              />
            ) : null}
          </div>

          <div className="lg:col-span-1">
            <OrderSummary
              items={checkout.items}
              subtotal={checkout.subtotal}
              shipping={checkout.shipping}
              installmentCommission={checkout.installmentCommission}
              total={checkout.total}
              paymentMethod={checkout.paymentMethod}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
