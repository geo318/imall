import { env } from "@repo/shared";
// Removed cacheLife/cacheTag imports - cacheComponents disabled
import { CACHE_LIFE, CACHE_TAGS } from "../constants";
import type { Cart } from "../services/cart.service";

const API_BASE = env.BACKEND_URL || "http://localhost:3001";

/**
 * Server-side function to fetch cart data
 * Uses Cache Components with 'use cache' directive
 */
export async function getCartServer(cartId: string): Promise<Cart> {
  // Removed "use cache" - cacheComponents disabled
  // Removed cacheLife/cacheTag - cacheComponents disabled

  const response = await fetch(`${API_BASE}/api/carts/${cartId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Cart not found");
    }
    throw new Error("Failed to load cart");
  }

  return response.json();
}
