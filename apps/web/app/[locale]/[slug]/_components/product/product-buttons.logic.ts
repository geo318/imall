import { addToCartSafe, createCartSafe } from "@/actions/carts";
import { writeCartIdToStorage } from "@/lib/cart-storage";

export const DEFAULT_CART_KEY = "cart";
export const BUY_NOW_CART_KEY = "cart:buy-now";
export const BUY_NOW_ITEM_QUANTITY = 1;

type CreateCartResponse = {
  ok: boolean;
  data?: { id?: string };
  error?: string;
};

type AddToCartResponse = {
  ok: boolean;
  error?: string;
};

type BuyNowDependencies = {
  createCart: () => Promise<CreateCartResponse>;
  addToCart: (cartId: string, variantId: string, quantity: number) => Promise<AddToCartResponse>;
  writeCartId: (cartId: string, key: string) => void;
};

const defaultBuyNowDependencies: BuyNowDependencies = {
  createCart: createCartSafe,
  addToCart: addToCartSafe,
  writeCartId: writeCartIdToStorage,
};

export function buildBuyNowCheckoutHref(cartKey: string = BUY_NOW_CART_KEY): string {
  return `/checkout?cartKey=${encodeURIComponent(cartKey)}`;
}

export async function createIsolatedBuyNowCart(
  variantId: string,
  dependencies: BuyNowDependencies = defaultBuyNowDependencies,
): Promise<string> {
  const createResult = await dependencies.createCart();
  if (!createResult.ok || !createResult.data?.id) {
    throw new Error(createResult.error ?? "Failed to create cart");
  }

  const cartId = createResult.data.id;
  const addResult = await dependencies.addToCart(cartId, variantId, BUY_NOW_ITEM_QUANTITY);
  if (!addResult.ok) {
    throw new Error(addResult.error ?? "Failed to add item to cart");
  }

  dependencies.writeCartId(cartId, BUY_NOW_CART_KEY);
  return cartId;
}
