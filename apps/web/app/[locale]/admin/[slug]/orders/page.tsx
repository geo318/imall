import type { Metadata } from "next";
import type { ApiProduct } from "@/lib/api/products";
import { getRequestOrigin } from "@/lib/server/request-origin";
import { getSuperadminCookieHeader } from "@/lib/superadmin";
import { OrdersTable } from "./orders-table";

type ApiOrderEntry = {
  id: string;
  status: string;
  total: string;
  currency: string | null;
  createdAt: string;
  itemCount: number;
};

type OrderLineItem = {
  id: string;
  title: string;
  sku: string | null;
  qty: number;
  price: number;
  currency: string;
};

type OrderEntry = ApiOrderEntry & {
  customerName: string;
  customerEmail: string;
  paymentStatus: "paid" | "pending" | "refunded";
  fulfillmentStatus: "unfulfilled" | "partial" | "fulfilled";
  shippingStatus: "pending" | "in_transit" | "delivered";
  shippingMethod: string;
  trackingNumber: string | null;
  destination: string;
  items: OrderLineItem[];
  isMock?: boolean;
};

async function fetchOrders(slug: string): Promise<ApiOrderEntry[]> {
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}/api/admin/${slug}/orders`, {
    cache: "no-store",
    headers: await getSuperadminCookieHeader(),
  });
  if (!response.ok) {
    throw new Error("Failed to load orders");
  }
  return response.json();
}

async function fetchProducts(slug: string): Promise<ApiProduct[]> {
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}/api/admin/${slug}/products?status=active`, {
    cache: "no-store",
    headers: await getSuperadminCookieHeader(),
  });
  if (!response.ok) {
    return [];
  }
  return response.json();
}

function normalizeOrders(orders: ApiOrderEntry[]): OrderEntry[] {
  return orders.map((order) => ({
    ...order,
    customerName: "Guest checkout",
    customerEmail: "guest@example.com",
    paymentStatus: order.status === "completed" ? "paid" : "pending",
    fulfillmentStatus:
      order.status === "completed"
        ? "fulfilled"
        : order.status === "processing"
          ? "partial"
          : "unfulfilled",
    shippingStatus:
      order.status === "completed"
        ? "delivered"
        : order.status === "processing"
          ? "in_transit"
          : "pending",
    shippingMethod: "Standard shipping",
    trackingNumber: null,
    destination: "Customer address on file",
    items: [
      {
        id: `${order.id}-item`,
        title: "Order items",
        sku: null,
        qty: order.itemCount,
        price: Number(order.total),
        currency: order.currency ?? "USD",
      },
    ],
  }));
}

function buildMockOrders(products: ApiProduct[]): OrderEntry[] {
  if (products.length === 0) {
    return [];
  }

  const customers = [
    { name: "Ava Collins", email: "ava@example.com" },
    { name: "Liam Stewart", email: "liam@example.com" },
    { name: "Maya Patel", email: "maya@example.com" },
    { name: "Noah Park", email: "noah@example.com" },
    { name: "Sofia Gomez", email: "sofia@example.com" },
  ];
  const statuses: ApiOrderEntry["status"][] = ["pending", "processing", "completed"];

  return products.slice(0, 8).map((product, index) => {
    const variant = product.variants[0];
    const priceValue = Number(variant?.price ?? product.priceMin ?? 24);
    const qty = (index % 3) + 1;
    const total = priceValue * qty;
    const status = statuses[index % statuses.length] ?? "pending";
    const customer = customers[index % customers.length];
    const createdAt = new Date(Date.now() - index * 36 * 60 * 60 * 1000).toISOString();
    const items: OrderLineItem[] = [
      {
        id: `${product.id}-item`,
        title: product.title,
        sku: variant?.sku ?? null,
        qty,
        price: Number(priceValue),
        currency: variant?.currency ?? product.currency ?? "USD",
      },
    ];

    return {
      id: `MOCK-${product.id.slice(0, 8)}`,
      status,
      total: total.toFixed(2),
      currency: variant?.currency ?? product.currency ?? "USD",
      createdAt,
      itemCount: qty,
      customerName: customer?.name ?? "",
      customerEmail: customer?.email ?? "",
      paymentStatus: status === "completed" ? "paid" : "pending",
      fulfillmentStatus:
        status === "completed" ? "fulfilled" : status === "processing" ? "partial" : "unfulfilled",
      shippingStatus:
        status === "completed" ? "delivered" : status === "processing" ? "in_transit" : "pending",
      shippingMethod: "Standard shipping",
      trackingNumber: status === "processing" ? "1Z9999999999999999" : null,
      destination: "123 Market St, San Francisco, CA",
      items,
      isMock: true,
    };
  });
}

export const metadata: Metadata = {
  title: "Orders",
};

export default async function OrdersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let orders = await fetchOrders(slug).catch(() => []);
  let isMock = false;

  if (orders.length === 0) {
    const products = await fetchProducts(slug);
    orders = buildMockOrders(products);
    isMock = orders.length > 0;
  } else {
    orders = normalizeOrders(orders);
  }

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Orders
        </p>
        <h1 className="text-3xl font-bold">Recent orders</h1>
        <p className="text-sm text-muted-foreground">
          Review orders and update statuses before notifying customers.
        </p>
      </div>

      <OrdersTable shopSlug={slug} orders={orders as OrderEntry[]} isMock={isMock} />
    </div>
  );
}
