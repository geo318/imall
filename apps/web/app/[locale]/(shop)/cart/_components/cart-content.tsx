"use client";

import { calculateCheckoutTotals } from "@repo/shared/checkout";
import { Button } from "@repo/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getCart, removeCartItem, updateCartItemQty } from "@/actions/carts";
import { sanitizeCheckoutCartKey } from "@/components/checkout/checkout-routing";
import LazyImage from "@/components/shared/lazy-image";
import { CartSkeleton } from "@/components/skeletons/cart-skeleton";
import { Link, useRouter, useSearchParams } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import type { CartItem } from "@/lib/api/cart";
import { getProductIdentifier } from "@/lib/api/products";
import {
  clearCartIdFromStorage,
  dispatchCartStorageUpdated,
  readCartIdFromStorage,
} from "@/lib/cart-storage";
import { queryGcTime } from "@/lib/query-gc-time";
import { revalidateCartClient } from "@/lib/revalidate-client";
import { cn } from "@/lib/utils";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";

export function CartContent() {
  const searchParams = useSearchParams();
  const cartKey = sanitizeCheckoutCartKey(searchParams.get("cartKey"), "cart");
  return <CartFlow key={cartKey} cartKey={cartKey} />;
}

function useCartContent(cartKey: string) {
  const t = useTranslations();
  const [cartId, setCartId] = useState<string | null>(null);
  const [isLoadingCartId, setIsLoadingCartId] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const id = readCartIdFromStorage(cartKey);
    setCartId(id);
    setIsLoadingCartId(false);
  }, [cartKey]);

  const {
    data: cart,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cart", cartId],
    queryFn: () => getCart(cartId as string),
    enabled: Boolean(cartId),
    staleTime: 30_000,
    gcTime: queryGcTime(10 * 60_000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      // Don't retry on 404 (cart not found)
      if (error instanceof Error && error.message.includes("not found")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Handle query errors with toast
  useEffect(() => {
    if (error) {
      const msg = error instanceof Error ? error.message : t("cart.toasts.loadFailed");
      // If cart not found, clear the invalid cart ID from localStorage
      if (msg.toLowerCase().includes("not found")) {
        clearCartIdFromStorage(cartKey);
        setCartId(null);
        toast.error(t("cart.toasts.notFound"), {
          description: t("cart.toasts.notFoundDescription"),
        });
      } else {
        toast.error(t("cart.toasts.loadFailed"), {
          description: msg,
        });
      }
    }
  }, [error, t, cartKey]);

  const items: CartItem[] = cart?.items ?? [];

  const unavailableItems = useMemo(() => {
    return items.filter((item) => {
      if (item.trackInventory === false) {
        return false;
      }
      const available = item.availableQty;
      // Item is unavailable if: sold out (available <= 0) or quantity exceeds available stock
      return (
        (available !== undefined && available <= 0) ||
        (available !== undefined && available < item.qty)
      );
    });
  }, [items]);

  const purchasableItems = useMemo(() => {
    return items.filter((item) => {
      if (item.trackInventory === false) {
        return true;
      }
      const available = item.availableQty;
      // Item is purchasable if: available is undefined (unknown, allow) or available > 0 and >= qty
      return available === undefined || (available > 0 && available >= item.qty);
    });
  }, [items]);

  const updateQtyMutation = useMutation({
    mutationFn: async (vars: { itemId: string; qty: number }) => {
      if (!cartId) throw new Error("No cart");
      await updateCartItemQty(cartId, vars.itemId, vars.qty);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cart", cartId] });
      dispatchCartStorageUpdated(cartId, cartKey);
      await revalidateCartClient();
      toast.success(t("cart.toasts.qtyUpdated"));
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : t("cart.toasts.qtyUpdateFailed");
      console.error("Failed to update cart item quantity:", err);
      toast.error(t("cart.toasts.qtyUpdateFailed"), {
        description: msg,
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!cartId) throw new Error("No cart");
      await removeCartItem(cartId, itemId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cart", cartId] });
      dispatchCartStorageUpdated(cartId, cartKey);
      await revalidateCartClient();
      toast.success(t("cart.toasts.itemRemoved"));
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : t("cart.toasts.removeFailed");
      console.error("Failed to remove cart item:", err);
      toast.error(t("cart.toasts.removeFailed"), {
        description: msg,
      });
    },
  });

  return {
    t,
    cartId,
    isLoadingCartId,
    isLoading,
    items,
    unavailableItems,
    purchasableItems,
    updateQtyMutation,
    removeItemMutation,
    ...calculateCheckoutTotals(purchasableItems, "card"),
  };
}

function CartFlow({ cartKey }: { cartKey: string }) {
  const router = useRouter();
  const {
    t,
    cartId,
    isLoadingCartId,
    isLoading,
    items,
    unavailableItems,
    purchasableItems,
    updateQtyMutation,
    removeItemMutation,
    subtotal,
    shipping,
    total,
  } = useCartContent(cartKey);

  // Show skeleton while loading cartId from localStorage or while fetching cart data
  if (isLoadingCartId || isLoading) {
    return (
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <CartSkeleton />
        </div>
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sticky top-24 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!cartId || items.length === 0) {
    return (
      <div className="text-center py-16">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t("cart.emptyTitle")}</h2>
        <p className="text-muted-foreground mb-6">{t("cart.emptyDescription")}</p>
        <Button>
          <Link href="/products">{t("cart.continueShopping")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Cart Items */}
      <div className="lg:col-span-2 space-y-4">
        {items.map((item) =>
          (() => {
            const available = item.availableQty;
            const tracksInventory = item.trackInventory !== false;
            // Treat undefined as "unknown" (not sold out), only 0 or negative means sold out
            const isSoldOut = tracksInventory && available !== undefined && available <= 0;
            const isOver = tracksInventory && available !== undefined && available < item.qty;
            const disablePlus =
              isSoldOut ||
              (tracksInventory && available !== undefined && item.qty >= available) ||
              updateQtyMutation.isPending;
            const disableMinus = isSoldOut || item.qty <= 1 || updateQtyMutation.isPending;

            return (
              <div
                key={item.id}
                className={cn("relative flex gap-4 p-4 bg-card rounded-xl border border-border")}
              >
                <div
                  className={cn(
                    "w-24 h-24 relative rounded-lg overflow-hidden bg-secondary",
                    isSoldOut && "opacity-30",
                  )}
                >
                  <LazyImage
                    src={item.productImageUrl || ""}
                    alt={item.productTitle}
                    width={96}
                    height={96}
                    wrapperContainerStyles="absolute inset-0"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{item.productTitle}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {item.sku ? t("cart.skuLabel", { sku: item.sku }) : t("cart.defaultVariant")}
                  </p>
                  {(isSoldOut || isOver) && (
                    <p className="mb-2 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                      {isSoldOut
                        ? t("cart.soldOut")
                        : t("cart.onlyLeft", { count: available ?? 0 })}
                    </p>
                  )}
                  <p className="font-bold text-primary">
                    {formatCurrencyAmount(Number(item.price), DEFAULT_CURRENCY_CODE)}
                  </p>
                  <Link
                    href={`/${getProductIdentifier(item.productId, item.productSlug)}`}
                    className="text-xs text-muted-foreground underline mt-2 inline-block hover:text-foreground"
                  >
                    {t("cart.viewProduct")}
                  </Link>
                </div>
                <div className="flex flex-col items-end justify-between relative z-20">
                  <button
                    type="button"
                    onClick={() => removeItemMutation.mutate(item.id)}
                    disabled={removeItemMutation.isPending}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-60"
                    aria-label={t("cart.aria.removeItem")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div
                    className={cn(
                      "flex items-center gap-2 bg-secondary rounded-full",
                      isSoldOut && "opacity-30",
                    )}
                  >
                    <button
                      type="button"
                      disabled={disableMinus}
                      onClick={() =>
                        updateQtyMutation.mutate({
                          itemId: item.id,
                          qty: item.qty - 1,
                        })
                      }
                      className="p-2 hover:bg-muted rounded-full transition-colors disabled:opacity-60 disabled:pointer-events-none"
                      aria-label={t("cart.aria.decreaseQty")}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.qty}</span>
                    <button
                      type="button"
                      disabled={disablePlus}
                      onClick={() =>
                        updateQtyMutation.mutate({
                          itemId: item.id,
                          qty: item.qty + 1,
                        })
                      }
                      className="p-2 hover:bg-muted rounded-full transition-colors disabled:opacity-60 disabled:pointer-events-none"
                      aria-label={t("cart.aria.increaseQty")}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })(),
        )}
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        <div className="bg-card border border-border rounded-xl p-6 sticky top-24">
          <h2 className="text-lg font-semibold mb-4">{t("cart.summary.title")}</h2>

          {unavailableItems.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {t("cart.summary.unavailableNotice")}
            </div>
          )}

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("cart.summary.subtotal")}</span>
              <span>{formatCurrencyAmount(subtotal, DEFAULT_CURRENCY_CODE)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("cart.summary.shipping")}</span>
              <span>
                {shipping === 0 ? (
                  <span className="text-success">{t("cart.summary.free")}</span>
                ) : (
                  formatCurrencyAmount(shipping, DEFAULT_CURRENCY_CODE)
                )}
              </span>
            </div>
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex justify-between text-base font-semibold">
                <span>{t("cart.summary.total")}</span>
                <span>{formatCurrencyAmount(total, DEFAULT_CURRENCY_CODE)}</span>
              </div>
            </div>
          </div>

          {shipping > 0 && (
            <p className="text-xs text-muted-foreground mt-4">
              {t("cart.summary.freeShippingHint", {
                amount: formatCurrencyAmount(100.01 - subtotal, DEFAULT_CURRENCY_CODE),
              })}
            </p>
          )}

          <Button
            className="w-full mt-6"
            size="lg"
            disabled={purchasableItems.length === 0 || unavailableItems.length > 0}
            onClick={() =>
              router.push(
                cartKey === "cart"
                  ? "/checkout"
                  : `/checkout?cartKey=${encodeURIComponent(cartKey)}`,
              )
            }
          >
            {t("cart.summary.proceedToCheckout")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button variant="ghost" className="w-full mt-2">
            <Link href="/products">{t("cart.continueShopping")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
