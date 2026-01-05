"use client";

import { fetchProductBySlug } from "@/lib/api/products";
import { env } from "@repo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  variants: {
    id: string;
    sku: string | null;
    price: string;
    currency: string;
    auction?: {
      id: string;
      status: string | null;
      startsAt: string;
      endsAt: string;
      startingBid?: string | null;
      minIncrement?: string | null;
      buyNowPrice?: string | null;
      currentPrice?: string | null;
      highestBidId?: string | null;
    } | null;
  }[];
};

type Props = {
  shopSlug: string;
  productSlug: string;
};

export function ProductClient({ shopSlug, productSlug }: Props) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [bidAmount, setBidAmount] = useState<string>("");
  const [bidError, setBidError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["product", shopSlug, productSlug],
    queryFn: () => fetchProductBySlug(shopSlug, productSlug),
    retry: false,
  });

  useEffect(() => {
    if (data?.variants?.[0]) {
      setSelectedVariantId(data.variants[0].id);
    }
  }, [data?.variants]);

  useEffect(() => {
    const v = data?.variants.find((variant) => variant.id === selectedVariantId);
    if (v?.auction) {
      const suggested =
        Number(v.auction?.currentPrice ?? v.auction?.startingBid ?? v.price ?? 0) +
        Number(v.auction?.minIncrement ?? 0);
      if (suggested > 0) {
        setBidAmount(String(suggested));
      }
    } else {
      setBidAmount("");
    }
  }, [data?.variants, selectedVariantId]);

  const ensureCart = async (): Promise<string> => {
    const key = `cart:${shopSlug}`;
    const cached = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (cached) return cached;
    const res = await fetch(`${env.NEXT_PUBLIC_DOMAIN}/api/shops/${shopSlug}/carts`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to create cart");
    const payload = (await res.json()) as { id: string };
    localStorage.setItem(key, payload.id);
    return payload.id;
  };

  const addToCart = async () => {
    if (!selectedVariantId) return;
    try {
      setAdding(true);
      const cartId = await ensureCart();
      const res = await fetch(
        `${env.NEXT_PUBLIC_DOMAIN}/api/shops/${shopSlug}/carts/${cartId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId: selectedVariantId, qty: 1 }),
        },
      );
      if (!res.ok) {
        throw new Error("Failed to add to cart");
      }
      router.push(`/${shopSlug}/cart`);
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) return <p className="p-4">Loading…</p>;
  if (isError || !data) {
    const notFound = error instanceof Error && error.message === "not-found";
    return (
      <p className={`p-4 ${notFound ? "text-slate-500" : "text-red-600"}`}>
        {notFound ? "Product not found." : "Failed to load this product."}
      </p>
    );
  }

  const selectedVariant = data.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const currentPrice = auction?.currentPrice ?? auction?.startingBid ?? selectedVariant?.price;
  const minIncrement = Number(auction?.minIncrement ?? 0);
  const suggestedBid =
    currentPrice !== undefined && currentPrice !== null
      ? Number(currentPrice) + minIncrement
      : undefined;

  const placeBid = async () => {
    if (!auction?.id || !bidAmount) return;
    setBidError(null);
    try {
      const res = await fetch(
        `${env.NEXT_PUBLIC_DOMAIN}/api/shops/${shopSlug}/auctions/${auction.id}/bids`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: bidAmount, bidderId: crypto.randomUUID() }),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to place bid");
      }
      await queryClient.invalidateQueries({ queryKey: ["product", shopSlug, productSlug] });
    } catch (err) {
      setBidError(err instanceof Error ? err.message : "Failed to place bid");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">{data.title}</h1>
      {data.description && <p className="text-gray-600">{data.description}</p>}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Variants</p>
        <div className="flex flex-wrap gap-2">
          {data.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVariantId(v.id)}
              className={`rounded border px-3 py-2 text-sm ${
                selectedVariantId === v.id
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {v.sku ?? "Default"} • {v.price} {v.currency}
            </button>
          ))}
          {data.variants.length === 0 && (
            <p className="text-sm text-slate-600">No variants available.</p>
          )}
        </div>
      </div>

      {auction && (
        <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Auction</div>
            <div className="text-xs uppercase">{auction.status ?? "active"}</div>
          </div>
          <p>
            Current price:{" "}
            <span className="font-semibold">
              {auction.currentPrice ?? auction.startingBid ?? "0"} {selectedVariant?.currency ?? ""}
            </span>
          </p>
          <p className="text-xs text-amber-800">
            Ends at {new Date(auction.endsAt).toLocaleString()}
            {auction.minIncrement && ` • Min increment ${auction.minIncrement}`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder={suggestedBid ? String(suggestedBid) : "Bid amount"}
              className="w-full rounded border border-amber-200 bg-white px-3 py-2 text-amber-900"
            />
            <button
              type="button"
              onClick={placeBid}
              className="whitespace-nowrap rounded bg-amber-600 px-4 py-2 text-white"
              disabled={!bidAmount}
            >
              Place bid
            </button>
          </div>
          {bidError && <p className="text-xs text-red-700">{bidError}</p>}
          {auction.buyNowPrice && (
            <p className="text-xs text-amber-800">
              Buy now available at {auction.buyNowPrice} {selectedVariant?.currency ?? ""}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
        onClick={addToCart}
        disabled={!selectedVariantId || adding}
      >
        {adding ? "Adding..." : "Add to cart"}
      </button>
    </div>
  );
}
