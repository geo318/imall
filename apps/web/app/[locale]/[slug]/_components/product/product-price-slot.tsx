"use client";

import type { ApiProduct } from "@/lib/api/products";

type Props = {
  product: ApiProduct;
  selectedVariantId: string | null;
};

/**
 * Dynamic slot: Price display (static from server data, no Suspense needed)
 */
export function ProductPriceSlot({ product, selectedVariantId }: Props) {
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const currentPrice = auction?.currentPrice ?? auction?.startingBid ?? selectedVariant?.price;
  const price = selectedVariant ? Number(selectedVariant.price) : 0;
  const currency = selectedVariant?.currency ?? "USD";

  if (auction) {
    return (
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">${Number(currentPrice ?? 0).toFixed(2)}</span>
          <span className="text-muted-foreground">{currency}</span>
        </div>
        <p className="text-sm text-muted-foreground">Current bid</p>
        {auction.buyNowPrice && (
          <p className="text-sm">
            Buy now:{" "}
            <span className="font-semibold">${Number(auction.buyNowPrice).toFixed(2)}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">${price.toFixed(2)}</span>
        <span className="text-muted-foreground">{currency}</span>
      </div>
    </div>
  );
}
