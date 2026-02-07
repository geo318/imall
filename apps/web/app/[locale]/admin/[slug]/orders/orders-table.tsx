"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Fragment, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled"] as const;

type OrderLineItem = {
  id: string;
  title: string;
  sku: string | null;
  qty: number;
  price: number;
  currency: string;
};

type OrderEntry = {
  id: string;
  status: string;
  total: string;
  currency: string | null;
  createdAt: string;
  itemCount: number;
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

type Props = {
  shopSlug: string;
  orders: OrderEntry[];
  isMock?: boolean;
};

const statusBadgeStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  processing: "bg-blue-100 text-blue-900",
  completed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-900",
};

const fulfillmentBadgeStyles: Record<string, string> = {
  unfulfilled: "bg-slate-100 text-slate-700",
  partial: "bg-amber-100 text-amber-900",
  fulfilled: "bg-emerald-100 text-emerald-900",
};

const paymentBadgeStyles: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-900",
  pending: "bg-amber-100 text-amber-900",
  refunded: "bg-red-100 text-red-900",
};

export function OrdersTable({ shopSlug, orders, isMock = false }: Props) {
  const [rows, setRows] = useState(orders);
  const [isPending, startTransition] = useTransition();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [statusChanges, setStatusChanges] = useState<Record<string, string>>(() =>
    Object.fromEntries(orders.map((order) => [order.id, order.status])),
  );

  useEffect(() => {
    setRows(orders);
    setStatusChanges(Object.fromEntries(orders.map((order) => [order.id, order.status])));
  }, [orders]);

  const handleChange = (orderId: string, status: string) => {
    setStatusChanges((prev) => ({ ...prev, [orderId]: status }));
  };

  const handleUpdate = (orderId: string) => {
    const fallbackStatus = rows.find((order) => order.id === orderId)?.status;
    const status = statusChanges[orderId] ?? fallbackStatus;
    if (!status) {
      toast.error("Select a status before updating");
      return;
    }
    if (isMock) {
      setRows((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
      toast.success("Mock order updated");
      return;
    }

    startTransition(async () => {
      setSelectedOrder(orderId);
      try {
        const response = await fetch(`/api/admin/${shopSlug}/orders`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, status }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Update failed");
        }
        const payload = await response.json();
        setRows((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: payload.status ?? order.status } : order,
          ),
        );
        toast.success("Order status updated");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update order");
      } finally {
        setSelectedOrder(null);
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No orders recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isMock && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Showing mock orders generated from your catalog. Connect live orders to replace this view.
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Fulfillment</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <Fragment key={order.id}>
                <tr className="border-t border-border">
                  <td className="px-4 py-4">
                    <div className="font-mono text-xs text-muted-foreground">{order.id}</div>
                    <Badge className={`mt-2 capitalize ${statusBadgeStyles[order.status] || ""}`}>
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900">{order.customerName}</div>
                    <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      className={`capitalize ${
                        fulfillmentBadgeStyles[order.fulfillmentStatus] || ""
                      }`}
                    >
                      {order.fulfillmentStatus}
                    </Badge>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {order.shippingStatus.replace("_", " ")}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      className={`capitalize ${paymentBadgeStyles[order.paymentStatus] || ""}`}
                    >
                      {order.paymentStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium">{order.itemCount} item(s)</div>
                    <div className="text-xs text-muted-foreground">
                      {order.items[0]?.title ?? "Items"}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold">
                    ${Number(order.total).toFixed(2)} {order.currency ?? "USD"}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <Select
                        name={`status-${order.id}`}
                        value={statusChanges[order.id]}
                        onValueChange={(value) => handleChange(order.id, value)}
                      >
                        <SelectTrigger className="w-full text-left">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(order.id)}
                          disabled={isPending && selectedOrder === order.id}
                        >
                          {isPending && selectedOrder === order.id ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedOrder((prev) => (prev === order.id ? null : order.id))
                          }
                        >
                          {expandedOrder === order.id ? "Hide" : "Details"}
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
                {expandedOrder === order.id && (
                  <tr className="border-t border-border bg-slate-50/50">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase text-muted-foreground">
                            Line items
                          </div>
                          <div className="mt-2 space-y-2">
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                              >
                                <div>
                                  <p className="font-medium text-slate-900">{item.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.sku ? `SKU ${item.sku}` : "No SKU"}
                                  </p>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                  <div>
                                    {item.qty} × ${item.price.toFixed(2)} {item.currency}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase text-muted-foreground">
                            Fulfillment
                          </div>
                          <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Destination</span>
                              <span>{order.destination}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Shipping</span>
                              <span>{order.shippingMethod}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Tracking</span>
                              <span>{order.trackingNumber ?? "Not assigned"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Status</span>
                              <span>{order.shippingStatus.replace("_", " ")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
