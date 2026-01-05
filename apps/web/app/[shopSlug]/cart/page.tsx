"use client";

import { env } from "@repo/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

type CartItem = {
  id: string;
  qty: number;
  productTitle: string;
  productSlug: string;
  price: string;
  currency: string;
  sku: string | null;
};

export default function CartPage({ params }: { params: { shopSlug: string } }) {
  const { shopSlug } = params;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const cartKey = `cart:${shopSlug}`;

  useEffect(() => {
    async function loadCart() {
      const cartId = typeof window !== "undefined" ? localStorage.getItem(cartKey) : null;
      if (!cartId) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${env.NEXT_PUBLIC_DOMAIN}/api/shops/${shopSlug}/carts/${cartId}`);
        if (!res.ok) {
          throw new Error("Failed to load cart");
        }
        const data = (await res.json()) as { items: CartItem[] };
        setItems(data.items ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load cart";
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    loadCart();
  }, [shopSlug, cartKey]);

  const checkout = async () => {
    const cartId = typeof window !== "undefined" ? localStorage.getItem(cartKey) : null;
    if (!cartId) {
      setError("Cart is missing. Add items again.");
      return;
    }
    try {
      setCheckingOut(true);
      const res = await fetch(
        `${env.NEXT_PUBLIC_DOMAIN}/api/shops/${shopSlug}/carts/${cartId}/checkout`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Checkout failed");
      }
      // Clear cart on success
      localStorage.removeItem(cartKey);
      setItems([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      setError(message);
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return <p className="p-4">Loading cart…</p>;
  }

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Your cart</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {items.length === 0 ? (
        <p>
          Your cart is empty.{" "}
          <Link className="text-blue-600 underline" href={`/${shopSlug}`}>
            Continue shopping
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded border border-slate-200 p-3"
            >
              <div>
                <p className="font-semibold">{item.productTitle}</p>
                <p className="text-sm text-slate-600">
                  {item.qty} × {item.price} {item.currency} {item.sku ? `(${item.sku})` : ""}
                </p>
                <Link
                  className="text-xs text-blue-600 underline"
                  href={`/${shopSlug}/${item.productSlug}`}
                >
                  View product
                </Link>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-60"
            onClick={checkout}
            disabled={checkingOut}
          >
            {checkingOut ? "Processing..." : "Proceed to checkout"}
          </button>
        </div>
      )}
    </div>
  );
}
