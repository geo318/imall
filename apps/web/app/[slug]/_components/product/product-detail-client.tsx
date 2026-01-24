"use client";

import { Badge } from "@repo/ui/badge";
import { ArrowLeft, CheckCircle, Gavel, Heart, ShieldCheck, Star, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import LazyImage from "@/components/shared/lazy-image";
import type { ApiProduct } from "@/lib/api/products";
import { cn } from "@/lib/utils";
import {
  ProductActionsSlot,
  ProductAvailabilitySlot,
  ProductFavoriteButton,
  ProductPriceSlot,
  ProductShareSlot,
  ProductStatusBanner,
  ProductViewTracker,
} from "./";

type Props = {
  product: ApiProduct;
  productIdentifier: string;
};

/**
 * Main client component - 95% static, only dynamic slots use Suspense
 */
export function ProductDetailClient({ product, productIdentifier }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const [selectedImage, setSelectedImage] = useState(0);

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const shopSlug = product.tenantSlug ?? "demo-shop";
  const shopName = product.tenantName ?? shopSlug;

  // Use actual product images, filter out invalid URLs
  const productImages = product.images
    ? product.images
        .map((img) => img.url)
        .filter((url): url is string => Boolean(url && url.trim() !== ""))
    : [];

  return (
    <div className="container py-6">
      {/* Track product view */}
      <ProductViewTracker productId={product.id} />
      {/* Static: Back Button */}
      <Link
        href={`/${shopSlug}`}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Products
      </Link>

      {/* Status Banner - shows if product is deleted or draft */}
      <ProductStatusBanner deletedAt={product.deletedAt} draft={product.draft} />

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Static: Images */}
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
            <LazyImage
              src={productImages[selectedImage]}
              alt={product.title}
              width={800}
              height={800}
              className="h-full w-full"
            />

            {auction && (
              <Badge className="absolute top-4 left-4 bg-warning text-warning-foreground gap-1 z-10">
                <Gavel className="h-3 w-3" />
                Live Auction
              </Badge>
            )}
          </div>
          {productImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {productImages.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  className={cn(
                    "flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors",
                    selectedImage === index
                      ? "border-primary"
                      : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <LazyImage
                    src={image}
                    alt={`${product.title} - Image ${index + 1}`}
                    width={80}
                    height={80}
                    className="h-full w-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Static: Details Container */}
        <div className="space-y-6">
          {/* Static: Vendor */}
          <Link href={`/${shopSlug}`} className="block">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center">
                <span className="text-sm font-semibold text-slate-600">
                  {shopName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium hover:text-emerald-600 transition-colors">
                    {shopName}
                  </span>
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>5.0</span>
                  <span>•</span>
                  <span>Verified Vendor</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Static: Title */}
          <h1 className="text-2xl md:text-3xl font-bold">{product.title}</h1>

          {/* Static: Variant Selection */}
          {product.variants.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">Variants</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition-colors",
                      selectedVariantId === v.id
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    {v.sku ?? "Default"} • {v.price} {v.currency}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price (static from server data) */}
          <ProductPriceSlot product={product} selectedVariantId={selectedVariantId} />

          {/* Availability (static from server, can refresh on demand) */}
          {!auction && (
            <ProductAvailabilitySlot
              product={product}
              selectedVariantId={selectedVariantId}
              productIdentifier={productIdentifier}
            />
          )}

          {/* Auction section - rendered above description */}
          {auction && (
            <ProductActionsSlot
              product={product}
              selectedVariantId={selectedVariantId}
              productIdentifier={productIdentifier}
            />
          )}

          {/* Static: Description */}
          {product.description && (
            <div className="space-y-2">
              <h3 className="font-semibold">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Static: Features */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Free shipping</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Secure payment</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Verified vendor</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Quality guaranteed</span>
            </div>
          </div>

          {/* Action Buttons (uses React Query for fresh data) - only for non-auction products */}
          {!auction && (
            <ProductActionsSlot
              product={product}
              selectedVariantId={selectedVariantId}
              productIdentifier={productIdentifier}
            />
          )}

          {/* Favorite Button */}
          <ProductFavoriteButton productId={product.id} />

          {/* Share Product */}
          <ProductShareSlot product={product} productIdentifier={productIdentifier} />
        </div>
      </div>
    </div>
  );
}
