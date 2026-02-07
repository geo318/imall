"use client";

import { Button } from "@repo/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation.client";
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
    onSuccess: async (cartId) => {
      // Invalidate React Query cache for the cart
      await queryClient.invalidateQueries({ queryKey: ["cart", cartId] });
      // Also invalidate server-side cache
      await revalidateCartClient();
      toast.success("Added to cart!");
      router.push("/cart");
    },
    onError: (err) => {
      toast.error("Failed to add to cart", {
        description: err instanceof Error ? err.message : "Failed to add to cart",
      });
    },
  });

  return (
    <div className="space-y-3">
      <Button
        className="w-full"
        size="lg"
        disabled={isDisabled || cartMutation.isPending}
        onClick={() => {
          if (selectedVariantId) {
            cartMutation.mutate({ variantId: selectedVariantId });
          }
        }}
      >
        {isSoldOut ? "Sold Out" : "Add to Cart"}
      </Button>
      <Button className="w-full" size="lg" variant="outline" disabled={isDisabled}>
        Buy Now
      </Button>
    </div>
  );
}
