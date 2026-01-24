import { Metadata } from "next";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

type OrderEntry = {
  id: string;
  status: string;
  total: string;
  currency: string | null;
  createdAt: string;
  itemCount: number;
};

async function fetchOrders(slug: string): Promise<OrderEntry[]> {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/orders`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load orders");
  }
  return response.json();
}

export const metadata: Metadata = {
  title: "Orders",
};

export default async function OrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const orders = await fetchOrders(slug);

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Orders</p>
        <h1 className="text-3xl font-bold">Recent orders</h1>
        <p className="text-sm text-muted-foreground">
          Track order status, totals, and item counts for the last 20 records.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t border-border">
                  <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{order.id}</td>
                  <td className="px-4 py-4 font-semibold text-sm">{order.status}</td>
                  <td className="px-4 py-4">{order.itemCount}</td>
                  <td className="px-4 py-4 font-semibold">
                    ${Number(order.total).toFixed(2)} {order.currency ?? "USD"}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
