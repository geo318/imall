"use client";

import { Button } from "@repo/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import { toast } from "sonner";
import { addToCart, createCart } from "@/actions/carts";
import { revalidateCartClient } from "@/lib/revalidate-client";

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

  const cartMutation = useMutation({
    mutationFn: async ({ variantId }: { variantId: string }) => {
      const key = "cart";
      const isClient = globalThis.window !== undefined;
      let cartId = isClient ? globalThis.window.localStorage.getItem(key) : null;

      if (!cartId) {
        const { id } = await createCart();
        cartId = id;
        if (isClient) {
          globalThis.window.localStorage.setItem(key, cartId);
        }
      }

      try {
        await addToCart(cartId, variantId, 1);
        return cartId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("not found") || msg === "NOT_FOUND") {
          if (isClient) {
            globalThis.window.localStorage.removeItem(key);
          }
          const { id } = await createCart();
          cartId = id;
          if (isClient) {
            globalThis.window.localStorage.setItem(key, cartId);
          }
          await addToCart(cartId, variantId, 1);
          return cartId;
        }
        throw err;
      }
    },
  });

  const addVariantAndNavigate = async (destination: "cart" | "checkout" | "checkoutInstallments") => {
    if (!selectedVariantId) return;

    try {
      const cartId = await cartMutation.mutateAsync({ variantId: selectedVariantId });
      await queryClient.invalidateQueries({ queryKey: ["cart", cartId] });
      await revalidateCartClient();

      if (destination === "cart") {
        toast.success(t("productButtons.toasts.added"));
        router.push("/cart");
        return;
      }

      if (destination === "checkoutInstallments") {
        router.push("/checkout?payment=installments&provider=credo");
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
        disabled={isDisabled || cartMutation.isPending}
        onClick={() => void addVariantAndNavigate("cart")}
      >
        {isSoldOut ? t("productButtons.soldOut") : t("productButtons.addToCart")}
      </Button>
      <Button
        className="w-full"
        size="lg"
        variant="outline"
        disabled={isDisabled || cartMutation.isPending}
        onClick={() => void addVariantAndNavigate("checkout")}
      >
        {t("productButtons.buyNow")}
      </Button>
      <Button
        className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        size="lg"
        variant="outline"
        disabled={isDisabled || cartMutation.isPending}
        onClick={() => void addVariantAndNavigate("checkoutInstallments")}
      >
        {t("productButtons.buyWithInstallments")}
      </Button>
    </div>
  );
}
