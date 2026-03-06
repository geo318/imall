"use client";

import { Badge } from "@repo/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  Gavel,
  Heart,
  Mail,
  Phone,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import LazyImage from "@/components/shared/lazy-image";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import type { ApiProduct } from "@/lib/api/products";
import { formatCurrencyAmount } from "@/lib/utils/currency";
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
  const t = useTranslations();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const [selectedImage, setSelectedImage] = useState(0);

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const selectedVariantOptionPairs = selectedVariant?.optionPairs ?? [];
  const shopSlug = product.tenantSlug ?? "demo-shop";
  const shopName = product.tenantName ?? shopSlug;
  const hasSellerInfo = Boolean(product.sellerEmail || product.sellerPhone || product.sellerRules);

  const productImages = useMemo(() => {
    const invalidTokens = new Set(["null", "undefined", "none", "no image"]);

    if (!product.images) {
      return [];
    }

    return Array.from(
      new Set(
        product.images
          .map((img) => img.url?.trim() ?? "")
          .filter((url) => url.length > 0 && !invalidTokens.has(url.toLowerCase())),
      ),
    );
  }, [product.images]);

  useEffect(() => {
    if (selectedImage < productImages.length) {
      return;
    }
    setSelectedImage(0);
  }, [productImages.length, selectedImage]);

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
        {t("productDetail.backToProducts")}
      </Link>

      {/* Status Banner - shows if product is deleted or draft */}
      <ProductStatusBanner deletedAt={product.deletedAt} draft={product.draft} />

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Static: Images */}
        <div className="space-y-4">
          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start md:gap-4">
            {productImages.length > 1 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 md:max-h-[560px] md:w-24 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:pb-0 md:pr-1">
                {productImages.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={cn(
                      "flex-shrink-0 h-20 w-20 rounded-xl overflow-hidden border-2 transition-colors",
                      selectedImage === index
                        ? "border-primary"
                        : "border-transparent opacity-70 hover:opacity-100",
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
            ) : null}

            <div className="relative aspect-square flex-1 overflow-hidden rounded-2xl bg-secondary">
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
                  {t("productDetail.liveAuction")}
                </Badge>
              )}
            </div>
          </div>
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
                  <span>{t("productDetail.verifiedVendor")}</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Static: Title */}
          <h1 className="text-2xl md:text-3xl font-bold">{product.title}</h1>

          {/* Static: Variant Selection */}
          {product.variants.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">{t("productDetail.variants")}</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const variantThumb = v.optionPairs?.find((pair) => pair.optionThumbnail);
                  const variantLabel =
                    v.optionPairs?.map((pair) => pair.optionValue).join(" / ") ||
                    v.sku ||
                    t("productDetail.defaultVariant");
                  return (
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
                      <span className="inline-flex items-center gap-2">
                        {variantThumb?.optionThumbnail ? (
                          <LazyImage
                            src={variantThumb.optionThumbnail}
                            alt={variantThumb.optionValue || t("productDetail.variantFallback")}
                            width={16}
                            height={16}
                            className="h-4 w-4 rounded object-cover border border-slate-200"
                          />
                        ) : null}
                        {`${variantLabel} • ${formatCurrencyAmount(v.price, v.currency)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedVariantOptionPairs.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">{t("productDetail.options")}</p>
              <div className="flex flex-wrap gap-2">
                {selectedVariantOptionPairs.map((pair) => (
                  <Badge key={`${pair.optionKey}-${pair.optionValue}`} variant="outline">
                    {pair.optionThumbnail ? (
                      <LazyImage
                        src={pair.optionThumbnail}
                        alt={pair.optionValue}
                        width={12}
                        height={12}
                        className="mr-1 h-3 w-3 rounded object-cover"
                      />
                    ) : null}
                    {pair.optionName}: {pair.optionValue}
                  </Badge>
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
              <h3 className="font-semibold">{t("productDetail.description")}</h3>
              <MarkdownContent content={product.description} className="prose-sm" />
            </div>
          )}

          {hasSellerInfo ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">{t("sellerInfo.title")}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {product.sellerEmail ? (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {t("sellerInfo.email")}: {product.sellerEmail}
                    </span>
                  </div>
                ) : null}
                {product.sellerPhone ? (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {t("sellerInfo.phone")}: {product.sellerPhone}
                    </span>
                  </div>
                ) : null}
              </div>
              {product.sellerRules ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("sellerInfo.rules")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {product.sellerRules}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Static: Features */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("productDetail.freeShipping")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("productDetail.securePayment")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("productDetail.verifiedVendor")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{t("productDetail.qualityGuaranteed")}</span>
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
