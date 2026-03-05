"use client";

import type { ApiProduct } from "@/lib/api/products";
import { useTranslations } from "@/i18n/provider";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";

type Props = {
  product: ApiProduct;
  selectedVariantId: string | null;
};

/**
 * Dynamic slot: Price display (static from server data, no Suspense needed)
 */
export function ProductPriceSlot({ product, selectedVariantId }: Props) {
  const t = useTranslations();
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const currentPrice = auction?.currentPrice ?? auction?.startingBid ?? selectedVariant?.price;
  const price = selectedVariant ? Number(selectedVariant.price) : 0;
  const currency = selectedVariant?.currency ?? DEFAULT_CURRENCY_CODE;

  if (auction) {
    return (
      <div className="space-y-2">
        <span className="text-3xl font-bold">{formatCurrencyAmount(currentPrice ?? 0, currency)}</span>
        <p className="text-sm text-muted-foreground">{t("productDetail.currentBid")}</p>
        {auction.buyNowPrice && (
          <p className="text-sm">
            {t("productDetail.buyNow")}:{" "}
            <span className="font-semibold">
              {formatCurrencyAmount(auction.buyNowPrice, currency)}
            </span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-3xl font-bold">{formatCurrencyAmount(price, currency)}</span>
    </div>
  );
}
