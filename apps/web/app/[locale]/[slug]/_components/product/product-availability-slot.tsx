"use client";

import { Badge } from "@repo/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiProduct } from "@/lib/api/products";
import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { getAvailabilityIcon, getStockStatus } from "./utils";

type Props = {
  product: ApiProduct;
  selectedVariantId: string | null;
  productIdentifier: string;
};

/**
 * Dynamic slot: Availability (uses server data, can refetch on demand)
 */
export function ProductAvailabilitySlot({ product, selectedVariantId, productIdentifier }: Props) {
  const t = useTranslations();
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const availableQty = selectedVariant?.availableQty;
  const trackInventory = selectedVariant?.trackInventory;
  const stockStatus = getStockStatus(availableQty, trackInventory);

  // Refetch for fresh stock data on demand
  const { refetch } = useQuery({
    queryKey: ["product", productIdentifier],
    queryFn: async () => {
      const { getProductByIdentifier } = await import("@/app/actions/products");
      return getProductByIdentifier(productIdentifier);
    },
    enabled: false, // Only refetch on demand
  });

  if (auction) {
    return null; // No availability section for auctions
  }

  const handleCheckAvailability = async () => {
    toast.loading(t("productAvailability.checking"), { id: "check-availability" });
    try {
      const result = await refetch();
      if (result.error) {
        throw result.error;
      }
      if (!result.data) {
        toast.error(t("productAvailability.checkFailed"), {
          id: "check-availability",
          description: t("productAvailability.noData"),
        });
        return;
      }
      const variant = result.data.variants.find((v: { id: string }) => v.id === selectedVariantId);
      if (!variant) {
        toast.error(t("productAvailability.checkFailed"), {
          id: "check-availability",
          description: t("productAvailability.variantNotFound"),
        });
        return;
      }
      if (variant.trackInventory === false) {
        toast.success(t("productAvailability.infoRetrieved"), {
          id: "check-availability",
          description: t("productAvailability.availableForPurchase"),
        });
        return;
      }
      if (variant.availableQty === undefined) {
        toast.success(t("productAvailability.infoRetrieved"), {
          id: "check-availability",
          description: t("productAvailability.availableForPurchase"),
        });
        return;
      }
      if (variant.availableQty > 0) {
        toast.success(t("productAvailability.stockAvailable"), {
          id: "check-availability",
          description: t("productAvailability.itemsInStock", { count: variant.availableQty }),
        });
      } else {
        toast.info(t("productAvailability.outOfStock"), {
          id: "check-availability",
          description: t("productAvailability.currentlyUnavailable"),
        });
      }
    } catch (error) {
      toast.error(t("productAvailability.checkFailed"), {
        id: "check-availability",
        description:
          error instanceof Error ? error.message : t("productAvailability.fetchFailed"),
      });
    }
  };

  const renderAvailabilityContent = () => {
    if (stockStatus === "sold" || stockStatus === "out_of_stock") {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 text-sm">
          {t("productAvailability.outOfStock")}
        </Badge>
      );
    }
    if (trackInventory === false) {
      return (
        <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-sm">
          {t("productAvailability.inStock")}
        </Badge>
      );
    }
    if (availableQty !== undefined) {
      return (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("productAvailability.inStock")}</span>
            <span
              className={cn(
                "font-semibold",
                stockStatus === "low" ? "text-warning" : "text-green-500",
              )}
            >
              {t("productAvailability.left", { count: availableQty })}
            </span>
          </div>

          {stockStatus === "low" && (
            <p className="text-xs text-warning font-medium">{t("productAvailability.lowStock")}</p>
          )}
        </>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="text-sm cursor-pointer hover:bg-slate-200 transition-colors"
        onClick={handleCheckAvailability}
      >
        {t("productAvailability.checkAvailability")}
      </Badge>
    );
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        {getAvailabilityIcon(stockStatus)}
        {t("productAvailability.title")}
      </h3>
      {renderAvailabilityContent()}
    </div>
  );
}
