import { Metadata } from "next";
import { Badge } from "@repo/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/table";
import type { ApiProduct } from "@/lib/api/products";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

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
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/returns`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load returns");
  }
  return response.json();
}

async function fetchProducts(slug: string): Promise<ApiProduct[]> {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/products?status=active`, {
    cache: "no-store",
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
    status: statuses[index % statuses.length],
    rmaNumber: `RMA-${1000 + index}`,
    refundAmount: Number(product.priceMin ?? 25) * 0.8,
    refundCurrency: product.currency ?? "USD",
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
  return `${currency ?? "USD"} ${value.toFixed(2)}`;
}

export const metadata: Metadata = {
  title: "Returns",
};

export default async function ReturnsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
          Returns
        </p>
        <h1 className="text-3xl font-bold">Returns & refunds</h1>
        <p className="text-sm text-muted-foreground">
          Track RMAs, refund status, and restock decisions.
        </p>
      </div>

      {isMock ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Showing mock return requests. Connect live return data when available.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Return requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RMA</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Refund</TableHead>
                <TableHead>Restock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                    No returns logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                returns.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.rmaNumber ?? entry.id}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(entry.status)} className="capitalize">
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(entry.requestedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{entry.items.length}</TableCell>
                    <TableCell>
                      {formatRefund(entry.refundAmount, entry.refundCurrency)}
                    </TableCell>
                    <TableCell className="capitalize">{entry.restockStatus}</TableCell>
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
