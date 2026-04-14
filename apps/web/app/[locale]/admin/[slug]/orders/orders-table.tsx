"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Fragment, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/i18n/provider";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";

const ORDER_STATUSES = ["approved", "pending", "processing", "completed", "cancelled"] as const;

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
  paymentMethod: string;
  userId: string | null;
  installmentOrderCode: string | null;
  installmentStatusId: number | null;
  installmentStatusName: string | null;
  installmentFlowStage: string | null;
  installmentVerificationCode: string | null;
  installmentStockConfirmedAt: string | null;
  installmentDeliveredAt: string | null;
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
  approved: "bg-indigo-100 text-indigo-900",
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
  const t = useTranslations();
  const tr = (key: string, fallback: string, values?: Record<string, string | number>) =>
    t(key, values) || fallback;
  const [rows, setRows] = useState(orders);
  const [isPending, startTransition] = useTransition();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [installmentCodes, setInstallmentCodes] = useState<Record<string, string>>({});
  const [statusChanges, setStatusChanges] = useState<Record<string, string>>(() =>
    Object.fromEntries(orders.map((order) => [order.id, order.status])),
  );

  useEffect(() => {
    setRows(orders);
    setStatusChanges(Object.fromEntries(orders.map((order) => [order.id, order.status])));
    setInstallmentCodes(
      Object.fromEntries(
        orders
          .filter((order) => Boolean(order.installmentVerificationCode))
          .map((order) => [order.id, order.installmentVerificationCode ?? ""]),
      ),
    );
  }, [orders]);

  const isCredoInstallmentOrder = (order: OrderEntry) =>
    order.paymentMethod === "installments_credo" && Boolean(order.installmentOrderCode);

  const handleChange = (orderId: string, status: string) => {
    setStatusChanges((prev) => ({ ...prev, [orderId]: status }));
  };

  const handleInstallmentAction = (
    orderId: string,
    action: "confirm_stock" | "verify_code",
    code?: string,
  ) => {
    startTransition(async () => {
      setSelectedOrder(orderId);
      try {
        const response = await fetch(`/api/admin/${shopSlug}/orders`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, action, code }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || tr("adminOrders.toasts.updateFailed", "Update failed"));
        }

        const payload = await response.json();
        setRows((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status: payload.status ?? order.status,
                  installmentFlowStage: payload.installmentFlowStage ?? order.installmentFlowStage,
                  installmentVerificationCode:
                    payload.verificationCode ?? order.installmentVerificationCode,
                }
              : order,
          ),
        );

        if (action === "confirm_stock") {
          setInstallmentCodes((prev) => ({ ...prev, [orderId]: "" }));
          toast.success(tr("adminOrders.toasts.stockConfirmed", "Stock confirmed"));
        } else {
          setInstallmentCodes((prev) => ({ ...prev, [orderId]: "" }));
          toast.success(tr("adminOrders.toasts.deliveryConfirmed", "Delivery confirmed"));
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : tr("adminOrders.toasts.updateFailed", "Failed to update order"),
        );
      } finally {
        setSelectedOrder(null);
      }
    });
  };

  const handleUpdate = (orderId: string) => {
    const fallbackStatus = rows.find((order) => order.id === orderId)?.status;
    const status = statusChanges[orderId] ?? fallbackStatus;
    if (!status) {
      toast.error(tr("adminOrders.toasts.selectStatus", "Select a status before updating"));
      return;
    }
    if (isMock) {
      setRows((prev) => prev.map((order) => (order.id === orderId ? { ...order, status } : order)));
      toast.success(tr("adminOrders.toasts.mockUpdated", "Mock order updated"));
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
          throw new Error(payload.error || tr("adminOrders.toasts.updateFailed", "Update failed"));
        }
        const payload = await response.json();
        setRows((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: payload.status ?? order.status } : order,
          ),
        );
        toast.success(tr("adminOrders.toasts.updated", "Order status updated"));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : tr("adminOrders.toasts.updateFailed", "Failed to update order"),
        );
      } finally {
        setSelectedOrder(null);
      }
    });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {tr("adminOrders.empty", "No orders recorded yet.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isMock && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {tr(
            "adminOrders.mockNotice",
            "Showing mock orders generated from your catalog. Connect live orders to replace this view.",
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{tr("adminOrders.table.order", "Order")}</th>
              <th className="px-4 py-3">{tr("adminOrders.table.customer", "Customer")}</th>
              <th className="px-4 py-3">{tr("adminOrders.table.fulfillment", "Fulfillment")}</th>
              <th className="px-4 py-3">{tr("adminOrders.table.payment", "Payment")}</th>
              <th className="px-4 py-3">{tr("adminOrders.table.items", "Items")}</th>
              <th className="px-4 py-3">{tr("adminOrders.table.total", "Total")}</th>
              <th className="px-4 py-3">{tr("adminOrders.table.created", "Created")}</th>
              <th className="px-4 py-3">{tr("adminOrders.table.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <Fragment key={order.id}>
                <tr className="border-t border-border">
                  <td className="px-4 py-4">
                    <div className="font-mono text-xs text-muted-foreground">{order.id}</div>
                    <Badge className={`mt-2 capitalize ${statusBadgeStyles[order.status] || ""}`}>
                      {tr(`adminOrders.statuses.${order.status}`, order.status)}
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
                      {tr(
                        `adminOrders.fulfillmentStatus.${order.fulfillmentStatus}`,
                        order.fulfillmentStatus,
                      )}
                    </Badge>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {tr(
                        `adminOrders.shippingStatus.${order.shippingStatus}`,
                        order.shippingStatus.replace("_", " "),
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      className={`capitalize ${paymentBadgeStyles[order.paymentStatus] || ""}`}
                    >
                      {tr(`adminOrders.paymentStatus.${order.paymentStatus}`, order.paymentStatus)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium">
                      {tr("adminOrders.itemsCount", `${order.itemCount} item(s)`, {
                        count: order.itemCount,
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.items[0]?.title ?? tr("adminOrders.table.items", "Items")}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold">
                    {formatCurrencyAmount(
                      Number(order.total),
                      order.currency ?? DEFAULT_CURRENCY_CODE,
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    {isCredoInstallmentOrder(order) ? (
                      <div className="space-y-2">
                        <p className="text-xs font-mono text-muted-foreground">
                          {order.installmentOrderCode}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tr(
                            `adminOrders.installments.stage.${order.installmentFlowStage ?? "unknown"}`,
                            order.installmentFlowStage ?? "unknown",
                          )}
                        </p>

                        {order.installmentFlowStage === "approved" ? (
                          <Button
                            size="sm"
                            onClick={() => handleInstallmentAction(order.id, "confirm_stock")}
                            disabled={isPending && selectedOrder === order.id}
                          >
                            {isPending && selectedOrder === order.id
                              ? tr("adminOrders.actions.saving", "Saving...")
                              : tr("adminOrders.installments.confirmStock", "Confirm stock")}
                          </Button>
                        ) : null}

                        {order.installmentFlowStage === "pending" ? (
                          <div className="space-y-2">
                            <Input
                              value={installmentCodes[order.id] ?? ""}
                              onChange={(event) =>
                                setInstallmentCodes((prev) => ({
                                  ...prev,
                                  [order.id]: event.target.value,
                                }))
                              }
                              placeholder={tr(
                                "adminOrders.installments.codePlaceholder",
                                "Enter code",
                              )}
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                handleInstallmentAction(
                                  order.id,
                                  "verify_code",
                                  (installmentCodes[order.id] || "").trim(),
                                )
                              }
                              disabled={
                                (isPending && selectedOrder === order.id) ||
                                !(installmentCodes[order.id] || "").trim()
                              }
                            >
                              {isPending && selectedOrder === order.id
                                ? tr("adminOrders.actions.saving", "Saving...")
                                : tr("adminOrders.installments.verifyCode", "Submit code")}
                            </Button>
                          </div>
                        ) : null}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedOrder((prev) => (prev === order.id ? null : order.id))
                          }
                        >
                          {expandedOrder === order.id
                            ? tr("adminOrders.actions.hide", "Hide")
                            : tr("adminOrders.actions.details", "Details")}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Select
                          name={`status-${order.id}`}
                          value={statusChanges[order.id]}
                          onValueChange={(value) => handleChange(order.id, value)}
                        >
                          <SelectTrigger className="w-full text-left">
                            <SelectValue placeholder={tr("adminOrders.actions.status", "Status")} />
                          </SelectTrigger>
                          <SelectContent>
                            {ORDER_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {tr(
                                  `adminOrders.statuses.${status}`,
                                  status.charAt(0).toUpperCase() + status.slice(1),
                                )}
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
                            {isPending && selectedOrder === order.id
                              ? tr("adminOrders.actions.saving", "Saving...")
                              : tr("adminOrders.actions.save", "Save")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setExpandedOrder((prev) => (prev === order.id ? null : order.id))
                            }
                          >
                            {expandedOrder === order.id
                              ? tr("adminOrders.actions.hide", "Hide")
                              : tr("adminOrders.actions.details", "Details")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
                {expandedOrder === order.id && (
                  <tr className="border-t border-border bg-slate-50/50">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase text-muted-foreground">
                            {tr("adminOrders.details.lineItems", "Line items")}
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
                                    {item.sku
                                      ? tr("adminOrders.details.sku", `SKU ${item.sku}`, {
                                          sku: item.sku,
                                        })
                                      : tr("adminOrders.details.noSku", "No SKU")}
                                  </p>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                  <div>
                                    {item.qty} ×{" "}
                                    {formatCurrencyAmount(
                                      item.price,
                                      item.currency ?? DEFAULT_CURRENCY_CODE,
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase text-muted-foreground">
                            {tr("adminOrders.details.fulfillment", "Fulfillment")}
                          </div>
                          <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                {tr("adminOrders.details.destination", "Destination")}
                              </span>
                              <span>{order.destination}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                {tr("adminOrders.details.shipping", "Shipping")}
                              </span>
                              <span>{order.shippingMethod}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                {tr("adminOrders.details.tracking", "Tracking")}
                              </span>
                              <span>
                                {order.trackingNumber ??
                                  tr("adminOrders.details.notAssigned", "Not assigned")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                {tr("adminOrders.table.status", "Status")}
                              </span>
                              <span>
                                {tr(
                                  `adminOrders.shippingStatus.${order.shippingStatus}`,
                                  order.shippingStatus.replace("_", " "),
                                )}
                              </span>
                            </div>
                            {isCredoInstallmentOrder(order) ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">
                                    {tr("adminOrders.installments.orderCode", "Order code")}
                                  </span>
                                  <span className="font-mono text-xs">
                                    {order.installmentOrderCode}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">
                                    {tr("adminOrders.installments.credoStatus", "Credo status")}
                                  </span>
                                  <span>{order.installmentStatusName || "--"}</span>
                                </div>
                              </>
                            ) : null}
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
