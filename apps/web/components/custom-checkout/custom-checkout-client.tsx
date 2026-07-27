"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Loader2, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const COMMISSION_RATE = 0.12;

type ProductRow = {
  id: number;
  title: string;
  price: string;
  qty: string;
};

function makeRow(id: number): ProductRow {
  return { id, title: "", price: "", qty: "1" };
}

function formatGel(amount: number): string {
  return `${amount.toFixed(2)} ₾`;
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CustomCheckoutClient({ pass }: { pass: string }) {
  const nextId = useRef(2);
  const [rows, setRows] = useState<ProductRow[]>([makeRow(1)]);
  const [customer, setCustomer] = useState({
    clientFullName: "",
    mobile: "",
    email: "",
    factAddress: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const base = rows.reduce((sum, row) => {
      const qty = Math.max(1, Math.floor(toNumber(row.qty)) || 1);
      return sum + toNumber(row.price) * qty;
    }, 0);
    const commission = base * COMMISSION_RATE;
    return { base, commission, grand: base + commission };
  }, [rows]);

  const validRows = rows.filter((row) => row.title.trim() && toNumber(row.price) > 0);

  function updateRow(id: number, patch: Partial<ProductRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, makeRow(nextId.current++)]);
  }

  function removeRow(id: number) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  async function handleSubmit() {
    setError(null);
    if (validRows.length === 0) {
      setError("Add at least one product with a name and price.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/custom-checkout/credo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pass,
          products: validRows.map((row) => ({
            title: row.title.trim(),
            price: toNumber(row.price),
            qty: Math.max(1, Math.floor(toNumber(row.qty)) || 1),
          })),
          clientFullName: customer.clientFullName.trim() || undefined,
          mobile: customer.mobile.trim() || undefined,
          email: customer.email.trim() || undefined,
          factAddress: customer.factAddress.trim() || undefined,
          credoVariant: "zero",
        }),
      });

      const data = (await response.json()) as { redirectUrl?: string; error?: string };
      if (!response.ok || !data.redirectUrl) {
        setError(data.error || "Failed to start Credo installments.");
        setSubmitting(false);
        return;
      }

      // Hand off to Credo — keep the spinner up during navigation.
      window.location.href = data.redirectUrl;
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <ShoppingCart className="h-6 w-6 text-emerald-600" />
        <h1 className="text-2xl font-semibold text-slate-900">Custom Credo Checkout</h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="space-y-3">
          {rows.map((row, index) => {
            const rowBase = toNumber(row.price) * Math.max(1, Math.floor(toNumber(row.qty)) || 1);
            return (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-[minmax(0,1fr)_120px_88px_auto]"
              >
                <div>
                  {index === 0 && (
                    <span className="mb-1 block text-xs text-slate-500">Product</span>
                  )}
                  <Input
                    placeholder="e.g. Xiaomi phone"
                    value={row.title}
                    onChange={(event) => updateRow(row.id, { title: event.target.value })}
                  />
                </div>
                <div>
                  {index === 0 && (
                    <span className="mb-1 block text-xs text-slate-500">Price (₾)</span>
                  )}
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={row.price}
                    onChange={(event) => updateRow(row.id, { price: event.target.value })}
                  />
                </div>
                <div>
                  {index === 0 && <span className="mb-1 block text-xs text-slate-500">Qty</span>}
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={row.qty}
                    onChange={(event) => updateRow(row.id, { qty: event.target.value })}
                  />
                </div>
                <div className={index === 0 ? "flex items-end" : "flex items-center"}>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    aria-label="Remove product"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {rowBase > 0 && (
                  <p className="text-xs text-slate-500 sm:col-span-4">
                    {formatGel(rowBase)} + 12% installments ={" "}
                    <span className="font-medium text-slate-700">
                      {formatGel(rowBase * (1 + COMMISSION_RATE))}
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <Button variant="outline" className="mt-4" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" /> Add product
        </Button>

        <hr className="my-6 border-slate-200" />

        <h2 className="mb-3 text-sm font-medium text-slate-700">Customer (optional)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Full name"
            value={customer.clientFullName}
            onChange={(event) =>
              setCustomer((current) => ({ ...current, clientFullName: event.target.value }))
            }
          />
          <Input
            placeholder="Mobile (5XXXXXXXX)"
            value={customer.mobile}
            onChange={(event) =>
              setCustomer((current) => ({ ...current, mobile: event.target.value }))
            }
          />
          <Input
            type="email"
            placeholder="Email"
            value={customer.email}
            onChange={(event) =>
              setCustomer((current) => ({ ...current, email: event.target.value }))
            }
          />
          <Input
            placeholder="Address"
            value={customer.factAddress}
            onChange={(event) =>
              setCustomer((current) => ({ ...current, factAddress: event.target.value }))
            }
          />
        </div>

        <hr className="my-6 border-slate-200" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatGel(totals.base)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Installment commission (12%)</span>
            <span>{formatGel(totals.commission)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatGel(totals.grand)}</span>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <Button
          className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSubmit}
          disabled={submitting || validRows.length === 0}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to Credo…
            </>
          ) : (
            `Buy with Credo · ${formatGel(totals.grand)}`
          )}
        </Button>
      </div>
    </div>
  );
}
