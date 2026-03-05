"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { use, useMemo } from "react";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import type { ApiProduct } from "@/lib/api/products";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";

type OrderEntry = {
  id: string;
  status: string;
  total: string;
  currency: string | null;
  createdAt: string;
  itemCount: number;
};

type PayoutEntry = {
  id: string;
  status: string;
  amount: string;
  paidAt?: string | null;
};

type ProductWithStats = ApiProduct & {
  stats?: {
    sold?: number;
  };
};

const sections = [
  {
    href: "settings",
    titleKey: "adminDashboard.sections.settings.title",
    descKey: "adminDashboard.sections.settings.desc",
    status: "active",
    requiresSeller: false,
  },
  {
    href: "payouts",
    titleKey: "adminDashboard.sections.payouts.title",
    descKey: "adminDashboard.sections.payouts.desc",
    status: "active",
    requiresSeller: true,
  },
  {
    href: "catalog",
    titleKey: "adminDashboard.sections.catalog.title",
    descKey: "adminDashboard.sections.catalog.desc",
    status: "active",
    requiresSeller: true,
  },
  {
    href: "orders",
    titleKey: "adminDashboard.sections.orders.title",
    descKey: "adminDashboard.sections.orders.desc",
    status: "active",
    requiresSeller: true,
  },
  {
    href: "returns",
    titleKey: "adminDashboard.sections.returns.title",
    descKey: "adminDashboard.sections.returns.desc",
    status: "active",
    requiresSeller: true,
  },
  {
    href: "shipping",
    titleKey: "adminDashboard.sections.shipping.title",
    descKey: "adminDashboard.sections.shipping.desc",
    status: "active",
    requiresSeller: true,
  },
  {
    href: "customers",
    titleKey: "adminDashboard.sections.customers.title",
    descKey: "adminDashboard.sections.customers.desc",
    status: "active",
    requiresSeller: true,
  },
];

export default function AdminShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = useTranslations();
  const { slug } = use(params);
  const parseAmount = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return 0;
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const { data: settings } = useQuery<{ canSell?: boolean }>({
    queryKey: ["admin-settings", slug],
    queryFn: async () => {
      const response = await fetch(`/api/admin/${slug}/settings`);
      if (!response.ok) {
        if (response.status === 404) return { canSell: false };
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || t("adminDashboard.errors.authRequired"));
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t("adminDashboard.errors.loadSettingsFailed"));
      }
      return response.json();
    },
    retry: false,
  });

  const canSell = Boolean(settings?.canSell);

  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery<ProductWithStats[]>({
    queryKey: ["admin-products", slug],
    queryFn: async () => {
      const response = await fetch(`/api/admin/${slug}/products?status=all`);
      if (!response.ok) {
        if (response.status === 404) return [];
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Authentication required. Please sign in.");
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch products");
      }
      return response.json();
    },
    enabled: canSell,
    retry: false, // Don't retry on auth errors
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<OrderEntry[]>({
    queryKey: ["admin-orders", slug],
    queryFn: async () => {
      const response = await fetch(`/api/admin/${slug}/orders`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
    enabled: canSell,
  });

  const {
    data: payouts,
    isLoading: payoutsLoading,
    error: payoutsError,
  } = useQuery<PayoutEntry[]>({
    queryKey: ["admin-payouts", slug],
    queryFn: async () => {
      const response = await fetch(`/api/admin/${slug}/payouts`);
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch payouts");
      }
      return response.json();
    },
    enabled: canSell,
    retry: false,
  });

  const visibleSections = useMemo(
    () => sections.filter((section) => canSell || !section.requiresSeller),
    [canSell],
  );

  const overview = useMemo(() => {
    const items = products ?? [];
    const activeItems = items.filter((product) => !product.deletedAt && !product.draft);
    const totalVariants = items.reduce(
      (sum, product) => sum + (product.variantCount ?? product.variants?.length ?? 0),
      0,
    );
    const unitsSold = items.reduce((sum, product) => sum + (product.stats?.sold ?? 0), 0);
    const lowStock = items.filter((product) =>
      product.variants.some(
        (variant) =>
          typeof variant.availableQty === "number" &&
          variant.availableQty > 0 &&
          variant.availableQty <= 5,
      ),
    ).length;
    const outOfStock = items.filter((product) =>
      product.variants.some(
        (variant) => typeof variant.availableQty === "number" && variant.availableQty <= 0,
      ),
    ).length;

    const orderRows = orders ?? [];
    const grossSales = orderRows.reduce((sum, order) => sum + Number(order.total), 0);
    const payoutRows = payouts ?? [];
    const withdrawn = payoutRows.reduce((sum, payout) => {
      if (payout.status === "paid" || payout.paidAt) {
        return sum + parseAmount(payout.amount);
      }
      return sum;
    }, 0);
    const outstanding = payoutRows.reduce((sum, payout) => {
      if (payout.status === "paid" || payout.status === "failed") {
        return sum;
      }
      return sum + parseAmount(payout.amount);
    }, 0);
    const pendingOrders = orderRows.filter((order) =>
      ["pending", "processing"].includes(order.status),
    ).length;

    const today = new Date();
    const dailySeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const dayKey = date.toISOString().slice(0, 10);
      const count = orderRows.filter((order) => order.createdAt.slice(0, 10) === dayKey).length;
      return {
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        count,
      };
    });
    const maxCount = Math.max(1, ...dailySeries.map((entry) => entry.count));

    return {
      productCount: items.length,
      activeProducts: activeItems.length,
      totalVariants,
      unitsSold,
      lowStock,
      outOfStock,
      grossSales,
      withdrawn,
      outstanding,
      pendingOrders,
      dailySeries,
      maxCount,
      recentOrders: orderRows
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    };
  }, [orders, payouts, products]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <Badge variant="secondary">Admin workspace</Badge>
              <CardTitle>{t("adminDashboard.managementTitle", { slug })}</CardTitle>
              <CardDescription>
                {t("adminDashboard.workspaceDescription")}
              </CardDescription>
            </div>
            <Link
              href={`/${slug}`}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              {t("adminDashboard.viewShop")}
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {visibleSections.map((section) => (
                <Card
                  key={section.href}
                  className="h-full border-slate-200 transition hover:border-brand-200 hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{t(section.titleKey)}</CardTitle>
                      <Badge variant={section.status === "active" ? "secondary" : "outline"}>
                        {section.status === "active"
                          ? t("adminDashboard.status.active")
                          : t("adminDashboard.status.wip")}
                      </Badge>
                    </div>
                    <CardDescription>{t(section.descKey)}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Link href={`/admin/${slug}/${section.href}`}>
                      <Button variant="outline" size="sm">
                        {t("adminDashboard.actions.open")}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
            {!canSell ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t("adminDashboard.pendingSellerNotice")}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Shop Overview */}
        {canSell ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-600" />
                <CardTitle>{t("adminDashboard.overview.title")}</CardTitle>
              </div>
              <Link href={`/admin/${slug}/catalog`}>
                <Button variant="outline" size="sm">
                  {t("adminDashboard.overview.manageCatalog")}
                </Button>
              </Link>
            </div>
            <CardDescription>{t("adminDashboard.overview.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {productsLoading || ordersLoading || payoutsLoading ? (
              <div className="text-center py-8 text-slate-600">
                {t("adminDashboard.overview.loading")}
              </div>
            ) : productsError || payoutsError ? (
              <div className="text-center py-8">
                <p className="text-red-600 font-semibold mb-2">
                  {(productsError instanceof Error
                    ? productsError.message
                    : payoutsError instanceof Error
                      ? payoutsError.message
                    : t("adminDashboard.errors.loadProductsFailed"))}
                </p>
                <p className="text-sm text-slate-600">{t("adminDashboard.errors.signInPrompt")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">{t("adminDashboard.metrics.grossSales")}</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {formatCurrencyAmount(overview.grossSales, DEFAULT_CURRENCY_CODE)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t("adminDashboard.metrics.last30Orders")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">{t("adminDashboard.metrics.withdrawn")}</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {formatCurrencyAmount(overview.withdrawn, DEFAULT_CURRENCY_CODE)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t("adminDashboard.metrics.estimatedPayouts")}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">
                      {t("adminDashboard.metrics.outstanding")}
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {formatCurrencyAmount(overview.outstanding, DEFAULT_CURRENCY_CODE)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t("adminDashboard.metrics.awaitingTransfer")}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">
                      {t("adminDashboard.metrics.activeListings")}
                    </div>
                    <div className="text-xl font-semibold text-slate-900">
                      {overview.activeProducts}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">{t("adminDashboard.metrics.variants")}</div>
                    <div className="text-xl font-semibold text-slate-900">
                      {overview.totalVariants}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">{t("adminDashboard.metrics.unitsSold")}</div>
                    <div className="text-xl font-semibold text-slate-900">{overview.unitsSold}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">
                      {t("adminDashboard.metrics.pendingOrders")}
                    </div>
                    <div className="text-xl font-semibold text-slate-900">
                      {overview.pendingOrders}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">
                          {t("adminDashboard.charts.ordersLast7Days")}
                        </div>
                        <div className="text-xs text-slate-500">{t("adminDashboard.charts.dailyVolume")}</div>
                      </div>
                      <Badge variant="secondary">
                        {t("adminDashboard.charts.productsCount", { count: overview.productCount })}
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-end gap-2 h-28">
                      {overview.dailySeries.map((entry) => (
                        <div key={entry.label} className="flex-1 flex flex-col items-center gap-2">
                          <div
                            className="w-full rounded-md bg-emerald-200"
                            style={{ height: `${(entry.count / overview.maxCount) * 100}%` }}
                          />
                          <span className="text-[10px] text-slate-500">{entry.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold">{t("adminDashboard.inventory.title")}</div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">{t("adminDashboard.inventory.lowStock")}</span>
                        <Badge variant="destructive">{overview.lowStock}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">{t("adminDashboard.inventory.outOfStock")}</span>
                        <Badge variant="destructive">{overview.outOfStock}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">{t("adminDashboard.inventory.totalProducts")}</span>
                        <Badge variant="secondary">{overview.productCount}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{t("adminDashboard.recentOrders.title")}</div>
                      <div className="text-xs text-slate-500">
                        {t("adminDashboard.recentOrders.subtitle")}
                      </div>
                    </div>
                    <Link href={`/admin/${slug}/orders`} className="text-xs text-brand-700">
                      {t("adminDashboard.recentOrders.viewAll")}
                    </Link>
                  </div>
                  {overview.recentOrders.length === 0 ? (
                    <div className="py-6 text-sm text-slate-500">
                      {t("adminDashboard.recentOrders.empty")}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {overview.recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{order.id}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-900">
                              {formatCurrencyAmount(Number(order.total), DEFAULT_CURRENCY_CODE)}
                            </p>
                            <Badge variant="secondary" className="capitalize">
                              {t(`adminOrders.statuses.${order.status}`) || order.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>
    </div>
  );
}
