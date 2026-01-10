"use client";

import { useUser } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { placeBid as placeBidApi } from "@/lib/api/auctions";
import { revalidateProductClient } from "@/lib/revalidate-client";
import type { ApiProduct } from "@/lib/services/products.service";
import { AuctionFormSkeleton, AuctionTimerSkeleton } from "../product/product-detail-skeleton";
import { AuctionTimerSlot } from "./auction-timer-slot";

type Props = {
  product: ApiProduct;
  selectedVariantId: string | null;
  productIdentifier: string;
  auction: NonNullable<ApiProduct["variants"][0]["auction"]>;
  selectedVariant: ApiProduct["variants"][0];
  shopSlug: string;
  isSoldOut: boolean;
};

/**
 * Auction bid card component with timer, bid info, and bid form
 */
export function AuctionBidCard({
  product: _product,
  selectedVariantId,
  productIdentifier,
  auction,
  selectedVariant,
  shopSlug,
  isSoldOut,
}: Props) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  // Get fresh data for real-time status
  const { data: freshData, isLoading: isLoadingFresh } = useQuery({
    queryKey: ["product", productIdentifier],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productIdentifier}`);
      if (!response.ok) throw new Error("Failed to fetch");
      return response.json();
    },
    staleTime: 0,
    refetchInterval: 5000, // Poll every 5s for auctions
    enabled: true,
  });

  const freshVariant = freshData?.variants?.find((v: { id: string }) => v.id === selectedVariantId);
  const freshAuction = freshVariant?.auction ?? auction;
  const isAuctionEnded = freshAuction
    ? new Date(freshAuction.endsAt).getTime() <= Date.now()
    : false;
  const isDisabled = isSoldOut || isAuctionEnded;

  const minBid = freshAuction
    ? Number(freshAuction.currentPrice ?? freshAuction.startingBid ?? selectedVariant?.price ?? 0) +
      Number(freshAuction.minIncrement ?? 0)
    : 0;

  // Always call useForm to maintain hook order
  const bidForm = useForm({
    defaultValues: { amount: "" },
    onSubmit: async ({ value }) => {
      if (!freshAuction?.id) return;
      await bidMutation.mutateAsync({
        shopSlug,
        auctionId: freshAuction.id,
        amount: value.amount,
      });
    },
  });

  useEffect(() => {
    if (freshAuction && minBid > 0) {
      bidForm.setFieldValue("amount", String(minBid));
    }
  }, [minBid, freshAuction, bidForm]);

  const bidMutation = useMutation({
    mutationFn: async ({
      shopSlug,
      auctionId,
      amount,
    }: {
      shopSlug: string;
      auctionId: string;
      amount: string;
    }) => {
      if (!user?.id) throw new Error("You must be signed in to place a bid");
      await placeBidApi(shopSlug, auctionId, { amount });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["product", productIdentifier],
      });
      await revalidateProductClient(productIdentifier);
      bidForm.reset();
      toast.success("Bid placed successfully!");
    },
    onError: (err) => {
      toast.error("Failed to place bid", {
        description: err instanceof Error ? err.message : "Failed to place bid",
      });
    },
  });

  return (
    <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
      {/* Timer - with granular skeleton */}
      {isLoadingFresh ? (
        <AuctionTimerSkeleton />
      ) : (
        <AuctionTimerSlot auction={freshAuction ?? auction} />
      )}

      {/* Anti-Snipe Notice */}
      {freshAuction?.minIncrement && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 text-sm">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-primary">Anti-Snipe Protection</span>
            <p className="text-muted-foreground">
              If a bid is placed in the last 5 minutes, the auction extends by 5 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Bid Info - with granular skeleton */}
      {isLoadingFresh ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-20 animate-pulse" />
            <div className="h-8 bg-slate-200 rounded w-24 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-20 animate-pulse" />
            <div className="h-8 bg-slate-200 rounded w-16 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Bid</p>
            <p className="text-2xl font-bold text-primary">
              $
              {Number(
                freshAuction?.currentPrice ??
                  freshAuction?.startingBid ??
                  selectedVariant?.price ??
                  0,
              ).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Bids</p>
            <p className="text-2xl font-bold">0</p>
          </div>
        </div>
      )}

      {/* Place Bid Form - with granular skeleton */}
      {isLoadingFresh ? (
        <AuctionFormSkeleton />
      ) : (
        <bidForm.Field
          name="amount"
          validators={{
            onChange: z.string().refine(
              (val) => {
                const num = Number(val);
                return !Number.isNaN(num) && num >= minBid;
              },
              { message: `Minimum bid is $${minBid.toFixed(2)}` },
            ),
          }}
        >
          {(field) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                bidForm.handleSubmit();
              }}
              className="space-y-3"
            >
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.50"
                    min={minBid}
                    placeholder={minBid.toFixed(2)}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="pl-8 h-12"
                    disabled={isDisabled || bidMutation.isPending}
                  />
                </div>
                <Button
                  type="submit"
                  variant="auction"
                  size="lg"
                  disabled={isDisabled || bidMutation.isPending}
                  className="h-12"
                >
                  <Gavel className="h-5 w-5" />
                  Place Bid
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Minimum bid: ${minBid.toFixed(2)}
              </p>
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive text-center">
                  {typeof field.state.meta.errors[0] === "string"
                    ? field.state.meta.errors[0]
                    : (field.state.meta.errors[0]?.message ?? "Invalid bid amount")}
                </p>
              )}
            </form>
          )}
        </bidForm.Field>
      )}
    </div>
  );
}
