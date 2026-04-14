"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { ArrowLeft, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation.client";
import { useLocale, useTranslations } from "@/i18n/provider";
import { formatCurrencyAmount } from "@/lib/utils/currency";

type UserOrder = {
  id: string;
  tenantId: string;
  shopSlug: string | null;
  shopName: string | null;
  status: string | null;
  paymentMethod: string;
  installmentOrderCode: string | null;
  installmentStatusName: string | null;
  installmentFlowStage: string | null;
  installmentVerificationCode: string | null;
  total: string;
  currency: string;
  createdAt: string;
  itemCount: number;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getLoadOrdersFallback(locale: string): string {
  if (locale === "ka") return "შეკვეთების ჩატვირთვა ვერ მოხერხდა.";
  if (locale === "ru") return "Не удалось загрузить заказы.";
  return "Failed to load orders.";
}

export default function AccountOrdersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const loadOrdersFallback = getLoadOrdersFallback(locale);

    async function loadOrders() {
      if (!cancelled) {
        setLoading(true);
        setErrorMessage(null);
      }
      try {
        const response = await fetch("/api/users/me/orders", {
          method: "GET",
          cache: "no-store",
        });
        if (response.status === 401) {
          if (!cancelled) setOrders([]);
          return;
        }
        if (!response.ok) {
          const raw = await response.text();
          let backendMessage: string | null = null;
          try {
            const parsed = JSON.parse(raw) as { error?: string; message?: string };
            backendMessage = parsed.error || parsed.message || null;
          } catch {
            backendMessage = raw || null;
          }
          throw new Error(backendMessage || loadOrdersFallback);
        }

        const payload = (await response.json()) as { orders?: UserOrder[] };
        const next = payload.orders ?? [];
        if (cancelled) return;
        setOrders(next);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : loadOrdersFallback;
        setErrorMessage(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return (
    <div className="container py-8 md:py-10">
      <Link
        href="/account"
        className="mb-6 inline-flex items-center text-sm text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("accountOrders.back")}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-emerald-600" />
            {t("accountOrders.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">{t("accountOrders.loading")}</p>
          ) : errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-slate-500">{t("accountOrders.empty")}</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-emerald-200"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {t("accountOrders.orderNumber", { id: order.id.slice(0, 8).toUpperCase() })}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {order.status || t("accountOrders.unknownStatus")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {t("accountOrders.shop", { shop: order.shopName || order.shopSlug || "iMall" })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {t("accountOrders.items", { count: order.itemCount })}
                  </p>
                  <p className="text-sm text-slate-600">
                    {t("accountOrders.paymentMethod", { method: order.paymentMethod })}
                  </p>
                  {order.paymentMethod.startsWith("installments_") ? (
                    <p className="text-sm text-slate-600">
                      {t("accountOrders.installmentStatus", {
                        status: order.installmentFlowStage || order.installmentStatusName || "--",
                      })}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {formatCurrencyAmount(order.total, order.currency)}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
                  </div>
                  {order.paymentMethod === "installments_credo" &&
                  order.installmentFlowStage === "pending" &&
                  order.installmentVerificationCode ? (
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                      <button
                        type="button"
                        className="text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline"
                        onClick={() =>
                          setRevealedCodes((previous) => ({
                            ...previous,
                            [order.id]: !previous[order.id],
                          }))
                        }
                      >
                        {revealedCodes[order.id]
                          ? t("accountOrders.hideCode")
                          : t("accountOrders.viewCode")}
                      </button>
                      {revealedCodes[order.id] ? (
                        <p className="mt-2 font-mono text-lg tracking-widest text-emerald-900">
                          {order.installmentVerificationCode}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
