"use client";

import { Suspense } from "react";
import type { ApiProduct } from "@/lib/api/products";
import { AuctionBidCard } from "../auctions/auction-bid-card";
import { ProductButtons } from "./product-buttons";
import { AuctionFormSkeleton } from "./product-detail-skeleton";

type Props = {
  product: ApiProduct;
  selectedVariantId: string | null;
  productIdentifier: string;
};

/**
 * Dynamic slot: Action buttons (depend on stock/auction status)
 */
export function ProductActionsSlot({ product, selectedVariantId, productIdentifier }: Props) {
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const shopSlug = product.tenantSlug ?? "demo-shop";
  const availableQty = selectedVariant?.availableQty;
  const isSoldOut = selectedVariant?.trackInventory !== false && availableQty !== undefined && availableQty <= 0;

  if (!selectedVariant) {
    return null;
  }

  if (auction) {
    return (
      <Suspense fallback={<AuctionFormSkeleton />}>
        <AuctionBidCard
          product={product}
          selectedVariantId={selectedVariantId}
          productIdentifier={productIdentifier}
          auction={auction}
          selectedVariant={selectedVariant}
          shopSlug={shopSlug}
          isSoldOut={isSoldOut}
        />
      </Suspense>
    );
  }

  const isAuctionEnded = false; // Not applicable for non-auction products
  const isDisabled = isSoldOut || isAuctionEnded;

  return (
    <ProductButtons
      selectedVariantId={selectedVariantId}
      isDisabled={isDisabled}
      isSoldOut={isSoldOut}
    />
  );
}
