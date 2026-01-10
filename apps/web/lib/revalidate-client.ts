import { CACHE_TAGS } from "./constants";

/**
 * Client-side function to trigger server-side cache revalidation
 * Called after mutations to ensure server cache is updated
 */
export async function revalidateClient(tags: string[], paths?: string[]): Promise<void> {
  try {
    await fetch("/api/revalidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags, paths }),
    });
  } catch (err) {
    // Silently fail - revalidation is best effort
    console.warn("Failed to revalidate cache:", err);
  }
}

/**
 * Revalidate product-related caches (client-side)
 */
export async function revalidateProductClient(productIdentifier: string): Promise<void> {
  await revalidateClient(
    [CACHE_TAGS.PRODUCT, `${CACHE_TAGS.PRODUCT}-${productIdentifier}`, CACHE_TAGS.PRODUCTS],
    ["/products", `/${productIdentifier}`],
  );
}

/**
 * Revalidate cart-related caches (client-side)
 */
export async function revalidateCartClient(): Promise<void> {
  await revalidateClient([CACHE_TAGS.CART], ["/cart"]);
}

/**
 * Revalidate shop-related caches (client-side)
 */
export async function revalidateShopClient(shopSlug: string): Promise<void> {
  await revalidateClient(
    [CACHE_TAGS.SHOP, `${CACHE_TAGS.SHOP}-${shopSlug}`, CACHE_TAGS.SHOPS],
    [`/${shopSlug}`, "/vendors"],
  );
}
