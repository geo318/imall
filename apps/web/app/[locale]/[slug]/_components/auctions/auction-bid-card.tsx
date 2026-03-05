"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { placeBid } from "@/actions/auctions";
import type { ApiProduct } from "@/lib/api/products";
import { useAuctionWebSocket } from "@/lib/hooks/use-auction-websocket";
import { revalidateProductClient } from "@/lib/revalidate-client";
import { calculateNextMinBid } from "@/lib/utils/bid-increments";
import { DEFAULT_CURRENCY_CODE, currencySymbol, formatCurrencyAmount } from "@/lib/utils/currency";
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
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  // Use WebSocket for real-time auction updates instead of polling
  const isAuctionActive = auction && new Date(auction.endsAt).getTime() > Date.now();

  // Track if user is currently winning
  const [isUserWinning, setIsUserWinning] = useState(false);

  // Memoize the onMessage callback to prevent infinite loops
  const handleWebSocketMessage = useCallback(
    (message: { type: string; bidderId?: string; amount?: string }) => {
      // Handle WebSocket messages - cache invalidation is handled in the hook
      if (message.type === "bid") {
        // Check if user is winning
        if (message.bidderId && message.bidderId === user?.id) {
          setIsUserWinning(true);
          return; // Don't show toast for own bids
        } else {
          setIsUserWinning(false);
        }
        toast.info(`New bid: ${formatCurrencyAmount(message.amount, DEFAULT_CURRENCY_CODE)}`, {
          duration: 3000,
        });
      } else if (message.type === "auction.finished") {
        setIsUserWinning(false);
        toast.info("Auction has ended", { duration: 5000 });
      }
    },
    [user?.id],
  );

  useAuctionWebSocket({
    shopSlug,
    auctionId: auction.id,
    enabled: isAuctionActive,
    onMessage: handleWebSocketMessage,
  });

  // Initial data fetch - no polling needed, WebSocket handles updates
  const { data: freshData, isLoading: isLoadingFresh } = useQuery({
    queryKey: ["product", productIdentifier],
    queryFn: async () => {
      const { getProductByIdentifier } = await import("@/app/actions/products");
      return getProductByIdentifier(productIdentifier);
    },
    staleTime: 30000, // Data stays fresh for 30s since WebSocket updates it
    refetchInterval: false, // No polling - WebSocket handles real-time updates
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: true,
  });

  const freshVariant = freshData?.variants?.find((v: { id: string }) => v.id === selectedVariantId);
  const freshAuction = freshVariant?.auction ?? auction;
  const isAuctionEnded = freshAuction
    ? new Date(freshAuction.endsAt).getTime() <= Date.now()
    : false;
  const isDisabled = isSoldOut || isAuctionEnded;

  // Check if user is winning on initial load and when auction data changes
  useEffect(() => {
    if (freshAuction && user?.id) {
      // Check if current user is the highest bidder
      // highestBidderId is the Clerk user ID (externalAuthId) from the database
      // It should match user.id from Clerk
      const isWinning = Boolean(
        freshAuction.highestBidderId && freshAuction.highestBidderId === user.id,
      );
      setIsUserWinning(isWinning);
    } else {
      setIsUserWinning(false);
    }
  }, [freshAuction, user?.id]);

  // Calculate minimum bid using standard increments
  const currentPrice = freshAuction
    ? Number(freshAuction.currentPrice ?? freshAuction.startingBid ?? selectedVariant?.price ?? 0)
    : 0;
  const minIncrement = freshAuction ? Number(freshAuction.minIncrement ?? 0) : 0;
  const minBid = calculateNextMinBid(currentPrice, minIncrement);

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

  // Auto-update bid input with suggested minimum bid amount
  const { setFieldValue } = bidForm;
  const initializedRef = useRef(false);

  // Initialize bid input on first mount
  useEffect(() => {
    if (freshAuction && minBid > 0 && !initializedRef.current) {
      const formattedBid = minBid.toFixed(2);
      setFieldValue("amount", formattedBid);
      initializedRef.current = true;
    }
  }, [freshAuction, minBid, setFieldValue]);

  // Update bid amount when minBid changes (after initialization)
  useEffect(() => {
    if (initializedRef.current && freshAuction && minBid > 0) {
      const formattedBid = minBid.toFixed(2);
      setFieldValue("amount", formattedBid);
    }
  }, [minBid, freshAuction, setFieldValue]);

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
      // Check authentication before making the API call
      if (!isSignedIn || !user?.id) {
        throw new Error("You must be signed in to place a bid. Please sign in and try again.");
      }

      // Get token from client-side session
      const token = await getToken();
      if (!token) {
        throw new Error("Unable to get authentication token. Please sign in again.");
      }

      // Clean token if it has more than 3 parts (malformed/duplicated)
      const tokenParts = token.split(".");
      const cleanToken = tokenParts.length > 3 ? tokenParts.slice(0, 3).join(".") : token;

      if (tokenParts.length > 3) {
        console.warn("[Client] Token has more than 3 parts, using first 3 parts only");
      }

      await placeBid(shopSlug, auctionId, amount, cleanToken);
    },
    onSuccess: async () => {
      // Invalidate React Query cache to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ["product", productIdentifier],
      });
      // Revalidate server cache (debounced - only call once)
      // Don't await to avoid blocking UI
      revalidateProductClient(productIdentifier).catch(() => {
        // Silently fail - revalidation is best effort
      });
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
        <AuctionTimerSlot auction={freshAuction ?? auction} isUserWinning={isUserWinning} />
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
              {formatCurrencyAmount(
                Number(
                  freshAuction?.currentPrice ??
                    freshAuction?.startingBid ??
                    selectedVariant?.price ??
                    0,
                ),
                DEFAULT_CURRENCY_CODE,
              )}
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
              {
                message: `Minimum bid is ${formatCurrencyAmount(minBid, DEFAULT_CURRENCY_CODE)}`,
              },
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
                    {currencySymbol(DEFAULT_CURRENCY_CODE)}
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
                    disabled={isDisabled || bidMutation.isPending || !isSignedIn}
                  />
                </div>
                <Button
                  type="submit"
                  variant="auction"
                  size="lg"
                  disabled={isDisabled || bidMutation.isPending || !isSignedIn}
                  className="h-12"
                >
                  <Gavel className="h-5 w-5" />
                  {isSignedIn ? "Place Bid" : "Sign in to bid"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Minimum bid: {formatCurrencyAmount(minBid, DEFAULT_CURRENCY_CODE)}
              </p>
              {!isSignedIn && (
                <p className="text-sm text-amber-600 text-center">Please sign in to place a bid</p>
              )}
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
