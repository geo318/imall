export type { ApiProduct, Product } from "@/lib/types/products";
export type {
  ProductSearchParams,
  ProductSearchResponse,
} from "../services/products.service";
export {
  getAnyProducts as fetchAnyProducts,
  getProductByIdentifier as fetchProductByIdentifier,
  getProductBySlug as fetchProductBySlug,
  getShopProducts as fetchShopProducts,
  searchProducts,
  searchShopProducts,
} from "../services/products.service";

// Helper to generate product identifier from product data (slug + short ID)
export function getProductIdentifier(
  productId: string | undefined,
  slug: string | undefined,
): string {
  if (!productId || !slug) {
    // Fallback if product data is incomplete
    return productId ?? slug ?? "unknown";
  }
  const shortId = productId.replaceAll("-", "").substring(0, 8);
  return `${slug}-${shortId}`;
}
