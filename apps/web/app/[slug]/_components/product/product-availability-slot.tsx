"use client";

import { Badge } from "@repo/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiProduct } from "@/lib/services/products.service";
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
  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const availableQty = selectedVariant?.availableQty;
  const stockTotal = availableQty === undefined ? 50 : Math.max(availableQty, 50);
  const stockSold = availableQty === undefined ? 0 : stockTotal - availableQty;
  const stockStatus = getStockStatus(availableQty);

  // Refetch for fresh stock data on demand
  const { refetch } = useQuery({
    queryKey: ["product", productIdentifier],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productIdentifier}`);
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
    enabled: false, // Only refetch on demand
  });

  if (auction) {
    return null; // No availability section for auctions
  }

  const handleCheckAvailability = async () => {
    toast.loading("Checking availability...", { id: "check-availability" });
    try {
      const result = await refetch();
      if (!result.data) {
        return;
      }
      const variant = result.data.variants.find((v: { id: string }) => v.id === selectedVariantId);
      if (variant?.availableQty === undefined) {
        toast.success("Stock information retrieved", {
          id: "check-availability",
          description: "Product is available for purchase",
        });
        return;
      }
      if (variant.availableQty > 0) {
        toast.success("Stock available", {
          id: "check-availability",
          description: `${variant.availableQty} items in stock`,
        });
      } else {
        toast.info("Out of stock", {
          id: "check-availability",
          description: "This item is currently unavailable",
        });
      }
    } catch {
      toast.error("Failed to check availability", {
        id: "check-availability",
        description: "Could not fetch current stock information",
      });
    }
  };

  const renderAvailabilityContent = () => {
    if (stockStatus === "sold") {
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-sm">Sold Out</Badge>;
    }
    if (stockStatus === "out_of_stock") {
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-sm">Out of Stock</Badge>;
    }
    if (availableQty !== undefined) {
      return (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">In Stock</span>
            <span
              className={cn(
                "font-semibold",
                stockStatus === "low" ? "text-warning" : "text-green-500",
              )}
            >
              {availableQty} left
            </span>
          </div>

          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                stockStatus === "low" ? "bg-warning" : "bg-green-500",
              )}
              style={{
                width: `${(availableQty / stockTotal) * 100}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{stockSold} sold</span>
            <span>{stockTotal} total</span>
          </div>

          {stockStatus === "low" && (
            <p className="text-xs text-warning font-medium">⚡ Low stock - order soon!</p>
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
        Check availability
      </Badge>
    );
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        {getAvailabilityIcon(stockStatus)}
        Availability
      </h3>
      {renderAvailabilityContent()}
    </div>
  );
}
