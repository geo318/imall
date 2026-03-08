"use client";

import { useTranslations } from "@/i18n/provider";
import type { CartItem } from "@/lib/api/cart";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";
import type { CheckoutPaymentMethod } from "./types";

type OrderSummaryProps = {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  installmentCommission: number;
  total: number;
  paymentMethod: CheckoutPaymentMethod;
};

export function OrderSummary({
  items,
  subtotal,
  shipping,
  installmentCommission,
  total,
  paymentMethod,
}: OrderSummaryProps) {
  const t = useTranslations();

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sticky top-24">
      <h2 className="text-lg font-semibold mb-4">{t("checkout.summary.title")}</h2>

      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-slate-600">
              {item.productTitle} × {item.qty}
            </span>
            <span>
              {formatCurrencyAmount(Number(item.price) * item.qty, DEFAULT_CURRENCY_CODE)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 pt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">{t("checkout.summary.subtotal")}</span>
          <span>{formatCurrencyAmount(subtotal, DEFAULT_CURRENCY_CODE)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">{t("checkout.summary.shipping")}</span>
          <span>
            {shipping === 0 ? (
              <span className="text-emerald-600">{t("checkout.summary.free")}</span>
            ) : (
              formatCurrencyAmount(shipping, DEFAULT_CURRENCY_CODE)
            )}
          </span>
        </div>
        {paymentMethod === "installments" ? (
          <div className="flex justify-between">
            <span className="text-slate-600">{t("checkout.summary.installmentFee")}</span>
            <span>{formatCurrencyAmount(installmentCommission, DEFAULT_CURRENCY_CODE)}</span>
          </div>
        ) : null}
        <div className="border-t border-slate-200 pt-3 mt-3">
          <div className="flex justify-between text-base font-semibold">
            <span>{t("checkout.summary.total")}</span>
            <span>{formatCurrencyAmount(total, DEFAULT_CURRENCY_CODE)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
