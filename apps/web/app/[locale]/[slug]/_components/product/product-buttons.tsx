"use client";

import { Button } from "@repo/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addToCartSafe, createCartSafe, getCart } from "@/actions/carts";
import { useRouter } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import {
  clearCartIdFromStorage,
  dispatchCartStorageUpdated,
  writeCartIdToStorage,
} from "@/lib/cart-storage";
import { revalidateCartClient } from "@/lib/revalidate-client";
import {
  buildBuyNowCheckoutHref,
  createIsolatedBuyNowCart,
  BUY_NOW_CART_KEY,
  DEFAULT_CART_KEY,
} from "./product-buttons.logic";

type Props = {
  selectedVariantId: string | null;
  isDisabled: boolean;
  isSoldOut: boolean;
};

/**
 * Product action buttons (Add to Cart, Buy Now)
 */
export function ProductButtons({ selectedVariantId, isDisabled, isSoldOut }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();

  const addToCartMutation = useMutation({
    mutationFn: async ({ variantId, cartKey }: { variantId: string; cartKey: string }) => {
      const isClient = globalThis.window !== undefined;
      let cartId = isClient ? globalThis.window.localStorage.getItem(cartKey) : null;

      if (cartId) {
        try {
          const cart = await getCart(cartId);
          if (cart.status !== "open") {
            throw new Error("Cart not found");
          }
        } catch {
          if (isClient) {
            clearCartIdFromStorage(cartKey);
          }
          cartId = null;
        }
      }

      if (!cartId) {
        const createResult = await createCartSafe();
        if (!createResult.ok) {
          throw new Error(createResult.error);
        }
        cartId = createResult.data.id;
        if (isClient) {
          writeCartIdToStorage(cartId, cartKey);
        }
      }

      try {
        const addResult = await addToCartSafe(cartId, variantId, 1);
        if (!addResult.ok) {
          throw new Error(addResult.error);
        }
        return cartId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.toLowerCase().includes("not found") ||
          msg.toLowerCase().includes("cart is not open") ||
          msg === "NOT_FOUND"
        ) {
          if (isClient) {
            clearCartIdFromStorage(cartKey);
          }
          const createResult = await createCartSafe();
          if (!createResult.ok) {
            throw new Error(createResult.error);
          }
          cartId = createResult.data.id;
          if (isClient) {
            writeCartIdToStorage(cartId, cartKey);
          }
          const retryAddResult = await addToCartSafe(cartId, variantId, 1);
          if (!retryAddResult.ok) {
            throw new Error(retryAddResult.error);
          }
          return cartId;
        }
        throw err;
      }
    },
  });

  const buyNowMutation = useMutation({
    mutationFn: async ({ variantId }: { variantId: string }) => createIsolatedBuyNowCart(variantId),
  });

  const addVariantAndNavigate = async (
    destination: "cart" | "checkout" | "checkoutInstallments",
  ) => {
    if (!selectedVariantId) return;

    try {
      if (destination === "checkout") {
        const buyNowCartId = await buyNowMutation.mutateAsync({ variantId: selectedVariantId });
        await queryClient.invalidateQueries({ queryKey: ["cart", buyNowCartId] });
        dispatchCartStorageUpdated(buyNowCartId, BUY_NOW_CART_KEY);
        await revalidateCartClient();
        router.push(buildBuyNowCheckoutHref());
        return;
      }

      const cartId = await addToCartMutation.mutateAsync({
        variantId: selectedVariantId,
        cartKey: DEFAULT_CART_KEY,
      });
      await queryClient.invalidateQueries({ queryKey: ["cart", cartId] });
      dispatchCartStorageUpdated(cartId, DEFAULT_CART_KEY);
      await revalidateCartClient();

      if (destination === "cart") {
        toast.success(t("productButtons.toasts.added"));
        router.push("/cart");
        return;
      }

      if (destination === "checkoutInstallments") {
        router.push("/checkout?payment=installments&provider=keepz");
        return;
      }

      router.push("/checkout");
    } catch (err) {
      toast.error(t("productButtons.toasts.addFailed"), {
        description: err instanceof Error ? err.message : t("productButtons.toasts.addFailed"),
      });
    }
  };

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        size="lg"
        disabled={isDisabled || addToCartMutation.isPending || buyNowMutation.isPending}
        onClick={() => void addVariantAndNavigate("cart")}
      >
        {isSoldOut ? t("productButtons.soldOut") : t("productButtons.addToCart")}
      </Button>
      <Button
        className="w-full"
        size="lg"
        variant="outline"
        disabled={isDisabled || addToCartMutation.isPending || buyNowMutation.isPending}
        onClick={() => void addVariantAndNavigate("checkout")}
      >
        {t("productButtons.buyNow")}
      </Button>
      <Button
        className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        size="lg"
        variant="outline"
        disabled={isDisabled || addToCartMutation.isPending || buyNowMutation.isPending}
        onClick={() => void addVariantAndNavigate("checkoutInstallments")}
      >
        {t("productButtons.buyWithInstallments")}
      </Button>
    </div>
  );
}
