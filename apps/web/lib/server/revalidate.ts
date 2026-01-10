import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "../constants";

/**
 * Revalidate product-related caches
 */
export function revalidateProduct(productIdentifier: string) {
  (revalidateTag as (tag: string) => void)(CACHE_TAGS.PRODUCT);
  (revalidateTag as (tag: string) => void)(`${CACHE_TAGS.PRODUCT}-${productIdentifier}`);
  (revalidateTag as (tag: string) => void)(CACHE_TAGS.PRODUCTS);
  revalidatePath("/products", "page");
  revalidatePath(`/${productIdentifier}`, "page");
}

/**
 * Revalidate shop-related caches
 */
export function revalidateShop(shopSlug: string) {
  (revalidateTag as (tag: string) => void)(CACHE_TAGS.SHOP);
  (revalidateTag as (tag: string) => void)(`${CACHE_TAGS.SHOP}-${shopSlug}`);
  (revalidateTag as (tag: string) => void)(CACHE_TAGS.SHOPS);
  revalidatePath(`/${shopSlug}`, "page");
  revalidatePath("/vendors", "page");
}

/**
 * Revalidate cart-related caches
 */
export function revalidateCart(cartId: string) {
  (revalidateTag as (tag: string) => void)(CACHE_TAGS.CART);
  (revalidateTag as (tag: string) => void)(`${CACHE_TAGS.CART}-${cartId}`);
  revalidatePath("/cart", "page");
}

/**
 * Revalidate all product caches
 */
export function revalidateAllProducts() {
  (revalidateTag as (tag: string) => void)(CACHE_TAGS.PRODUCTS);
  revalidatePath("/products", "page");
  revalidatePath("/", "page");
}

/**
 * Revalidate all shop caches
 */
export function revalidateAllShops() {
  (revalidateTag as (tag: string) => void)(CACHE_TAGS.SHOPS);
  revalidatePath("/vendors", "page");
}
