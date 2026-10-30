"use client";

import { Button } from "@repo/ui/button";
import { useTranslations } from "@/i18n/provider";

type CheckoutInstallmentBannerProps = {
  pendingOrderCode: string | null;
  pendingRedirectUrl: string | null;
  onClear: () => void;
  onCheckStatus: () => Promise<void>;
  checkingStatus: boolean;
};

export function CheckoutInstallmentBanner({
  pendingOrderCode,
  pendingRedirectUrl,
  onClear,
  onCheckStatus,
  checkingStatus,
}: CheckoutInstallmentBannerProps) {
  const t = useTranslations();

  if (!pendingOrderCode) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-medium text-emerald-900">
        {t("checkout.installments.pendingOrderCode")}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void onCheckStatus()} disabled={checkingStatus}>
          {t(
            checkingStatus
              ? "checkout.installments.checkingStatus"
              : "checkout.installments.checkStatus",
          )}
        </Button>
        {pendingRedirectUrl ? (
          <Button
            type="button"
            disabled={checkingStatus}
            onClick={() => {
              globalThis.window.location.assign(pendingRedirectUrl);
            }}
          >
            {t("checkout.installments.openBankPage")}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClear} disabled={checkingStatus}>
          {t("checkout.installments.clearPending")}
        </Button>
      </div>
    </div>
  );
}
