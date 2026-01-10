"use client";

import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { placeBid as placeBidApi } from "@/lib/api/auctions";
import { addToCart as addToCartApi, createCart } from "@/lib/api/cart";
import { fetchProductByIdentifier } from "@/lib/api/products";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Gavel,
  Heart,
  Share2,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tenantSlug?: string;
  tenantName?: string;
  variants: {
    id: string;
    sku: string | null;
    price: string;
    currency: string;
    availableQty?: number;
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
  productIdentifier: string;
};

export function ProductClient({ productIdentifier }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [timeLeft, setTimeLeft] = useState("");
  const [isEnding, setIsEnding] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<ProductDetail>({
    queryKey: ["product", productIdentifier],
    queryFn: () => fetchProductByIdentifier(productIdentifier) as Promise<ProductDetail>,
    retry: false,
    staleTime: 0, // Always refetch to get latest stock
  });

  useEffect(() => {
    if (data?.variants?.[0]) {
      setSelectedVariantId(data.variants[0].id);
    }
  }, [data?.variants]);

  const selectedVariant = data?.variants.find((v) => v.id === selectedVariantId);
  const auction = selectedVariant?.auction ?? null;
  const shopSlug = data?.tenantSlug ?? "demo-shop";
  const shopName = data?.tenantName ?? shopSlug;
  const availableQty = selectedVariant?.availableQty;
  // Treat undefined as "unknown" (not sold out), only 0 or negative means sold out
  const isSoldOut = availableQty !== undefined && availableQty <= 0;
  const isAuctionEnded = timeLeft === "Ended";
  const isDisabled = isSoldOut || isAuctionEnded;

  // Calculate stock status for display (mocking total/sold for now)
  const stockTotal = availableQty !== undefined ? Math.max(availableQty, 50) : 50; // Assume at least 50 total
  const stockSold = availableQty !== undefined ? stockTotal - availableQty : 0;
  const stockStatus: "sold" | "out_of_stock" | "low" | "in_stock" | "unknown" = isSoldOut
    ? "sold"
    : availableQty !== undefined && availableQty <= 0
      ? "out_of_stock"
      : availableQty !== undefined && availableQty <= 5
        ? "low"
        : availableQty !== undefined && availableQty > 5
          ? "in_stock"
          : "unknown";

  // Countdown timer for auction
  useEffect(() => {
    if (!auction?.endsAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const end = new Date(auction.endsAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        setIsEnding(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      setIsEnding(diff < 5 * 60 * 1000); // Less than 5 minutes
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction?.endsAt]);

  // When auction ends, automatically refetch availability if not available
  useEffect(() => {
    if (isAuctionEnded && availableQty === undefined) {
      queryClient.invalidateQueries({
        queryKey: ["product", productIdentifier],
      });
    }
  }, [isAuctionEnded, availableQty, queryClient, productIdentifier]);

  // Cart mutation
  const cartMutation = useMutation({
    mutationFn: async ({ variantId }: { variantId: string }) => {
      const key = "cart";
      let cartId = typeof window !== "undefined" ? localStorage.getItem(key) : null;

      if (!cartId) {
        const { id } = await createCart();
        cartId = id;
        if (typeof window !== "undefined") {
          localStorage.setItem(key, cartId);
        }
      }

      try {
        await addToCartApi(cartId, variantId, 1);
        return cartId;
      } catch (err) {
        // If the stored cart id is stale (e.g. DB was reset), recreate and retry once.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("not found") || msg === "NOT_FOUND") {
          if (globalThis.window) {
            globalThis.window.localStorage.removeItem(key);
          }
          const { id } = await createCart();
          cartId = id;
          if (globalThis.window) {
            globalThis.window.localStorage.setItem(key, cartId);
          }
          await addToCartApi(cartId, variantId, 1);
          return cartId;
        }
        throw err;
      }
    },
    onSuccess: () => {
      toast.success("Added to cart!");
      router.push("/cart");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to add to cart";
      console.error("Failed to add to cart:", err);
      toast.error("Failed to add to cart", {
        description: msg,
      });
    },
  });

  // Calculate min bid
  const minBid = auction
    ? Number(auction.currentPrice ?? auction.startingBid ?? selectedVariant?.price ?? 0) +
      Number(auction.minIncrement ?? 0)
    : 0;

  // Bid form
  const bidForm = useForm({
    defaultValues: {
      amount: "",
    },
    onSubmit: async ({ value }) => {
      if (!auction?.id) return;
      await bidMutation.mutateAsync({
        shopSlug,
        auctionId: auction.id,
        amount: value.amount,
      });
    },
  });

  // Update form default when minBid changes
  useEffect(() => {
    if (auction && minBid > 0) {
      bidForm.setFieldValue("amount", String(minBid));
    }
  }, [minBid, auction, bidForm]);

  // Bid mutation
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
      if (!user?.id) {
        throw new Error("You must be signed in to place a bid");
      }
      // bidderId is now handled by backend from auth token
      await placeBidApi(shopSlug, auctionId, {
        amount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", productIdentifier] });
      bidForm.reset();
      toast.success("Bid placed successfully!");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to place bid";
      console.error("Failed to place bid:", err);
      toast.error("Failed to place bid", {
        description: message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <MarketingNav />
        <main className="flex-1 container py-6">
          <p className="p-4">Loading…</p>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  if (isError || !data) {
    const notFound = error instanceof Error && error.message === "not-found";
    return (
      <div className="min-h-screen flex flex-col">
        <MarketingNav />
        <main className="flex-1 container py-6">
          <p className={`p-4 ${notFound ? "text-slate-500" : "text-red-600"}`}>
            {notFound ? "Product not found." : "Failed to load this product."}
          </p>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  // Generate images from product slug
  const productImages = [
    `https://picsum.photos/seed/${data.slug}-1/800/800`,
    `https://picsum.photos/seed/${data.slug}-2/800/800`,
    `https://picsum.photos/seed/${data.slug}-3/800/800`,
  ];

  const currentPrice = auction?.currentPrice ?? auction?.startingBid ?? selectedVariant?.price;
  const price = selectedVariant ? Number(selectedVariant.price) : 0;
  const currency = selectedVariant?.currency ?? "USD";

  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />
      <main className="flex-1">
        <div className="container py-6">
          {/* Back Button */}
          <Link
            href={`/${shopSlug}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products
          </Link>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Images */}
            <div className="space-y-4">
              <div
                className={cn(
                  "relative aspect-square overflow-hidden rounded-2xl bg-secondary",
                  stockSold && "opacity-30",
                )}
              >
                {productImages[selectedImage] && (
                  <Image
                    src={productImages[selectedImage]}
                    alt={data.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                )}
                {auction && (
                  <Badge className="absolute top-4 left-4 bg-amber-500 text-amber-900 gap-1">
                    <Gavel className="h-3 w-3" />
                    Live Auction
                  </Badge>
                )}
              </div>
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
                    <Image
                      src={image}
                      alt=""
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-6">
              {/* Vendor */}
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

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold">{data.title}</h1>

              {/* Variant Selection */}
              {data.variants.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-800">Variants</p>
                  <div className="flex flex-wrap gap-2">
                    {data.variants.map((v) => (
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

              {/* Stock Availability */}
              {!auction && (
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    {stockStatus === "out_of_stock" || stockStatus === "sold" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : stockStatus === "low" ? (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    Availability
                  </h3>

                  {stockStatus === "sold" ? (
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-sm">
                      Sold Out
                    </Badge>
                  ) : stockStatus === "out_of_stock" ? (
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-sm">
                      Out of Stock
                    </Badge>
                  ) : availableQty !== undefined ? (
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

                      {/* Stock progress bar */}
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
                        <p className="text-xs text-warning font-medium">
                          ⚡ Low stock - order soon!
                        </p>
                      )}
                    </>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-sm cursor-pointer hover:bg-slate-200 transition-colors"
                      onClick={async () => {
                        toast.loading("Checking availability...", {
                          id: "check-availability",
                        });
                        try {
                          const result = await refetch();
                          if (result.data) {
                            const variant = result.data.variants.find(
                              (v) => v.id === selectedVariantId,
                            );
                            if (variant?.availableQty !== undefined) {
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
                            } else {
                              toast.success("Stock information retrieved", {
                                id: "check-availability",
                                description: "Product is available for purchase",
                              });
                            }
                          } else {
                            toast.error("Failed to check availability", {
                              id: "check-availability",
                              description: "Could not fetch current stock information",
                            });
                          }
                        } catch (err) {
                          toast.error("Failed to check availability", {
                            id: "check-availability",
                            description: "Could not fetch current stock information",
                          });
                        }
                      }}
                    >
                      Check availability
                    </Badge>
                  )}
                </div>
              )}

              {/* Auction Section */}
              {auction ? (
                <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
                  {/* Timer */}
                  <div
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl",
                      isAuctionEnded ? "bg-slate-100" : isEnding ? "bg-red-50" : "bg-amber-50",
                    )}
                  >
                    <Clock
                      className={cn(
                        "h-5 w-5",
                        isAuctionEnded
                          ? "text-slate-600"
                          : isEnding
                            ? "text-red-600"
                            : "text-amber-600",
                      )}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        {isAuctionEnded ? "Auction status" : "Auction ends in"}
                      </p>
                      <p
                        className={cn(
                          "font-bold text-lg",
                          isAuctionEnded && "text-slate-600",
                          isEnding && !isAuctionEnded && "text-red-600",
                        )}
                      >
                        {isAuctionEnded ? "Ended" : timeLeft || "Calculating..."}
                      </p>
                    </div>
                  </div>

                  {/* Anti-Snipe Notice */}
                  {auction.minIncrement && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 text-sm">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-emerald-700">Anti-Snipe Protection</span>
                        <p className="text-muted-foreground">
                          If a bid is placed in the last 5 minutes, the auction extends by 5
                          minutes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bid Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Bid</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        ${Number(currentPrice ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Starting Bid</p>
                      <p className="text-2xl font-bold">
                        ${Number(auction.startingBid ?? 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Place Bid Form */}
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
                              placeholder={minBid.toFixed(2)}
                              value={field.state.value}
                              onChange={(e) => field.handleChange(e.target.value)}
                              onBlur={field.handleBlur}
                              className="pl-8 h-12"
                              min={minBid}
                              step="0.50"
                            />
                          </div>
                          <Button
                            type="submit"
                            disabled={isDisabled || bidMutation.isPending || !field.state.value}
                            className="bg-amber-600 hover:bg-amber-700 text-white gap-2 h-12 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Gavel className="h-5 w-5" />
                            {isAuctionEnded
                              ? "Auction Ended"
                              : isSoldOut
                                ? "Sold Out"
                                : bidMutation.isPending
                                  ? "Placing..."
                                  : "Place Bid"}
                          </Button>
                        </div>
                        {field.state.meta.errors.length > 0 && (
                          <p className="text-xs text-red-600 text-center">
                            {field.state.meta.errors.map((error) => error?.message).join(", ") ??
                              ""}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground text-center">
                          Minimum bid: ${minBid.toFixed(2)}
                        </p>
                      </form>
                    )}
                  </bidForm.Field>

                  {auction.buyNowPrice && (
                    <div className="space-y-2">
                      <Button
                        onClick={() => {
                          if (selectedVariantId) {
                            cartMutation.mutate({ variantId: selectedVariantId });
                          }
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isDisabled || cartMutation.isPending || !selectedVariantId}
                      >
                        {isAuctionEnded
                          ? "Auction Ended"
                          : isSoldOut
                            ? "Sold Out"
                            : cartMutation.isPending
                              ? "Processing..."
                              : `Buy Now - $${Number(auction.buyNowPrice).toFixed(2)}`}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-3xl font-bold">${price.toFixed(2)}</p>
                  <Button
                    onClick={() => {
                      if (selectedVariantId) {
                        cartMutation.mutate({ variantId: selectedVariantId });
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={isSoldOut || cartMutation.isPending || !selectedVariantId}
                  >
                    {isSoldOut
                      ? "Sold Out"
                      : cartMutation.isPending
                        ? "Adding to cart..."
                        : "Add to Cart"}
                  </Button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2">
                  <Heart className="h-5 w-5" />
                  Save
                </Button>
                <Button variant="outline" className="flex-1 gap-2">
                  <Share2 className="h-5 w-5" />
                  Share
                </Button>
              </div>

              {/* Description */}
              {data.description && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Description</h3>
                  <p className="text-muted-foreground leading-relaxed">{data.description}</p>
                </div>
              )}

              {/* Shipping */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50">
                <Truck className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium">Free Shipping</p>
                  <p className="text-sm text-muted-foreground">
                    Estimated delivery: 5-7 business days
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
