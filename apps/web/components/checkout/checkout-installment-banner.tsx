"use client";

import { Button } from "@repo/ui/button";
import { useTranslations } from "@/i18n/provider";

type CheckoutInstallmentBannerProps = {
  pendingOrderCode: string | null;
  statusMessage: string | null;
  checkingStatus: boolean;
  submitting: boolean;
  onSyncStatus: () => Promise<void> | void;
  onClear: () => void;
};

export function CheckoutInstallmentBanner({
  pendingOrderCode,
  statusMessage,
  checkingStatus,
  submitting,
  onSyncStatus,
  onClear,
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
        <Button
          type="button"
          variant="outline"
          onClick={() => void onSyncStatus()}
          disabled={checkingStatus || submitting}
        >
          {checkingStatus
            ? t("checkout.installments.checkingStatus")
            : t("checkout.installments.checkStatus")}
        </Button>
        <Button type="button" variant="ghost" onClick={onClear}>
          {t("checkout.installments.clearPending")}
        </Button>
      </div>
      {statusMessage ? <p className="mt-3 text-sm text-slate-700">{statusMessage}</p> : null}
    </div>
  );
}
