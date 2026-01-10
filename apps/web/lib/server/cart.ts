import { env } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_LIFE, CACHE_TAGS } from "../constants";
import type { Cart } from "../services/cart.service";

const API_BASE = env.BACKEND_URL || "http://localhost:3001";

/**
 * Server-side function to fetch cart data
 * Uses Cache Components with 'use cache' directive
 */
export async function getCartServer(cartId: string): Promise<Cart> {
  "use cache";
  cacheLife(CACHE_LIFE.CART);
  cacheTag(CACHE_TAGS.CART);
  cacheTag(`${CACHE_TAGS.CART}-${cartId}`);

  const response = await fetch(`${API_BASE}/api/carts/${cartId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Cart not found");
    }
    throw new Error("Failed to load cart");
  }

  return response.json();
}
