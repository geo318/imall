import { Badge } from "@repo/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import type { ApiProduct } from "@/lib/api/products";
import { getRequestOrigin } from "@/lib/server/request-origin";
import { getServerAuthCookieHeader } from "@/lib/superadmin";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";

type ReturnItem = {
  id: string;
  qty: number;
  restockQty: number | null;
  condition: string | null;
};

type ReturnEntry = {
  id: string;
  status: string;
  rmaNumber: string | null;
  refundAmount: number | string | null;
  refundCurrency: string | null;
  requestedAt: string;
  restockStatus: string;
  items: ReturnItem[];
};

async function fetchReturns(slug: string): Promise<ReturnEntry[]> {
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}/api/admin/${slug}/returns`, {
    cache: "no-store",
    headers: await getServerAuthCookieHeader(),
  });
  if (!response.ok) {
    throw new Error("Failed to load returns");
  }
  return response.json();
}

async function fetchProducts(slug: string): Promise<ApiProduct[]> {
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}/api/admin/${slug}/products?status=active`, {
    cache: "no-store",
    headers: await getServerAuthCookieHeader(),
  });
  if (!response.ok) {
    return [];
  }
  return response.json();
}

function buildMockReturns(products: ApiProduct[]): ReturnEntry[] {
  if (products.length === 0) {
    return [];
  }
  const statuses = ["requested", "approved", "received", "refunded"];
  return products.slice(0, 5).map((product, index) => ({
    id: `RMA-${product.id.slice(0, 6)}`,
    status: statuses[index % statuses.length] ?? "requested",
    rmaNumber: `RMA-${1000 + index}`,
    refundAmount: Number(product.priceMin ?? 25) * 0.8,
    refundCurrency: product.currency ?? DEFAULT_CURRENCY_CODE,
    requestedAt: new Date(Date.now() - index * 2 * 24 * 60 * 60 * 1000).toISOString(),
    restockStatus: index % 2 === 0 ? "pending" : "restocked",
    items: [
      {
        id: `item-${product.id}`,
        qty: 1,
        restockQty: index % 2 === 0 ? 0 : 1,
        condition: index % 2 === 0 ? "opened" : "new",
      },
    ],
  }));
}

function statusVariant(status: string) {
  if (status === "refunded") return "secondary";
  if (status === "received") return "outline";
  return "default";
}

function formatRefund(amount: number | string | null, currency: string | null) {
  if (amount === null) return "--";
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return "--";
  return formatCurrencyAmount(value, currency ?? DEFAULT_CURRENCY_CODE);
}

export const metadata: Metadata = {
  title: "Returns",
};

export default async function ReturnsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations(locale as Locale);
  let returns = await fetchReturns(slug).catch(() => []);
  let isMock = false;

  if (returns.length === 0) {
    const products = await fetchProducts(slug);
    returns = buildMockReturns(products);
    isMock = returns.length > 0;
  }

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("adminReturns.eyebrow")}
        </p>
        <h1 className="text-3xl font-bold">{t("adminReturns.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("adminReturns.description")}</p>
      </div>

      {isMock ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t("adminReturns.mockNotice")}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("adminReturns.requestsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminReturns.table.rma")}</TableHead>
                <TableHead>{t("adminReturns.table.status")}</TableHead>
                <TableHead>{t("adminReturns.table.requested")}</TableHead>
                <TableHead>{t("adminReturns.table.items")}</TableHead>
                <TableHead>{t("adminReturns.table.refund")}</TableHead>
                <TableHead>{t("adminReturns.table.restock")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                    {t("adminReturns.empty")}
                  </TableCell>
                </TableRow>
              ) : (
                returns.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.rmaNumber ?? entry.id}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(entry.status)} className="capitalize">
                        {t(`adminReturns.status.${entry.status}`) || entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(entry.requestedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.items.length}</TableCell>
                    <TableCell>{formatRefund(entry.refundAmount, entry.refundCurrency)}</TableCell>
                    <TableCell className="capitalize">
                      {t(`adminReturns.restock.${entry.restockStatus}`) || entry.restockStatus}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
