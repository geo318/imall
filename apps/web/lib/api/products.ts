export type { ApiProduct } from "../services/products.service";
export {
  getShopProducts as fetchShopProducts,
  getProductByIdentifier as fetchProductByIdentifier,
  getProductBySlug as fetchProductBySlug,
  getAnyProducts as fetchAnyProducts,
  searchProducts,
} from "../services/products.service";

// Helper to generate product identifier from product data (slug + short ID)
export function getProductIdentifier(productId: string, slug: string): string {
  const shortId = productId.replaceAll("-", "").substring(0, 8);
  return `${slug}-${shortId}`;
}
