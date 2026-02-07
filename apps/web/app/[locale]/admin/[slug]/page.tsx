"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { use, useMemo } from "react";
import { Link } from "@/i18n/navigation.client";
import type { ApiProduct } from "@/lib/api/products";

type OrderEntry = {
  id: string;
  status: string;
  total: string;
  currency: string | null;
  createdAt: string;
  itemCount: number;
};

type ProductWithStats = ApiProduct & {
  stats?: {
    sold?: number;
  };
};

const sections = [
  {
    href: "settings",
    title: "Shop settings",
    desc: "Name, branding, bank details, payout notes",
    status: "active",
  },
  {
    href: "payouts",
    title: "Payouts",
    desc: "Settlement schedule, ledger, chargebacks",
    status: "active",
  },
  {
    href: "catalog",
    title: "Catalog",
    desc: "Products, markdown descriptions, variants, media",
    status: "active",
  },
  {
    href: "orders",
    title: "Orders",
    desc: "Payments, shipping status, fulfillment notes",
    status: "active",
  },
  {
    href: "returns",
    title: "Returns",
    desc: "RMAs, refunds, restock tracking",
    status: "active",
  },
  {
    href: "shipping",
    title: "Shipping",
    desc: "Rates, carriers, fulfillment rules",
    status: "active",
  },
  {
    href: "customers",
    title: "Customers",
    desc: "Segments, lifetime value, outreach",
    status: "active",
  },
];

export default function AdminShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

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
  });

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
    const withdrawn = grossSales * 0.6;
    const outstanding = grossSales - withdrawn;
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
  }, [orders, products]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <Badge variant="secondary">Admin workspace</Badge>
              <CardTitle>{slug} management</CardTitle>
              <CardDescription>
                Clerk roles pending; assume admin-only for now. Hook API mutations to these sections
                next.
              </CardDescription>
            </div>
            <Link
              href={`/${slug}`}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              View shop →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map((section) => (
                <Card
                  key={section.href}
                  className="h-full border-slate-200 transition hover:border-brand-200 hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <Badge variant={section.status === "active" ? "secondary" : "outline"}>
                        {section.status === "active" ? "Active" : "WIP"}
                      </Badge>
                    </div>
                    <CardDescription>{section.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Link href={`/admin/${slug}/${section.href}`}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Shop Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-600" />
                <CardTitle>Shop overview</CardTitle>
              </div>
              <Link href={`/admin/${slug}/catalog`}>
                <Button variant="outline" size="sm">
                  Manage Catalog
                </Button>
              </Link>
            </div>
            <CardDescription>Sales, inventory health, and order activity</CardDescription>
          </CardHeader>
          <CardContent>
            {productsLoading || ordersLoading ? (
              <div className="text-center py-8 text-slate-600">Loading overview...</div>
            ) : productsError ? (
              <div className="text-center py-8">
                <p className="text-red-600 font-semibold mb-2">
                  {productsError instanceof Error
                    ? productsError.message
                    : "Failed to load products"}
                </p>
                <p className="text-sm text-slate-600">Please sign in to access admin features.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Gross sales</div>
                    <div className="text-2xl font-bold text-slate-900">
                      ${overview.grossSales.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">Last 30 orders</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Withdrawn</div>
                    <div className="text-2xl font-bold text-slate-900">
                      ${overview.withdrawn.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">Estimated payouts</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Outstanding balance</div>
                    <div className="text-2xl font-bold text-slate-900">
                      ${overview.outstanding.toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">Awaiting next transfer</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Active listings</div>
                    <div className="text-xl font-semibold text-slate-900">
                      {overview.activeProducts}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Variants</div>
                    <div className="text-xl font-semibold text-slate-900">
                      {overview.totalVariants}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Units sold</div>
                    <div className="text-xl font-semibold text-slate-900">{overview.unitsSold}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs text-slate-500">Pending orders</div>
                    <div className="text-xl font-semibold text-slate-900">
                      {overview.pendingOrders}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">Orders last 7 days</div>
                        <div className="text-xs text-slate-500">
                          Daily order volume (mock when no orders)
                        </div>
                      </div>
                      <Badge variant="secondary">{overview.productCount} products</Badge>
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
                    <div className="text-sm font-semibold">Inventory health</div>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Low stock</span>
                        <Badge variant="destructive">{overview.lowStock}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Out of stock</span>
                        <Badge variant="destructive">{overview.outOfStock}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Total products</span>
                        <Badge variant="secondary">{overview.productCount}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Recent orders</div>
                      <div className="text-xs text-slate-500">Latest activity snapshot</div>
                    </div>
                    <Link href={`/admin/${slug}/orders`} className="text-xs text-brand-700">
                      View all
                    </Link>
                  </div>
                  {overview.recentOrders.length === 0 ? (
                    <div className="py-6 text-sm text-slate-500">No orders yet.</div>
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
                              ${Number(order.total).toFixed(2)}
                            </p>
                            <Badge variant="secondary" className="capitalize">
                              {order.status}
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
      </div>
    </div>
  );
}
