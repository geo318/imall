import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS, safeTag } from "../constants";

export function revalidateProduct(productIdentifier: string) {
  revalidateTag(CACHE_TAGS.PRODUCT, "max");
  revalidateTag(safeTag(`${CACHE_TAGS.PRODUCT}-${productIdentifier}`), "max");
  revalidateTag(CACHE_TAGS.PRODUCTS, "max");
  revalidatePath("/products", "page");
  revalidatePath(`/${productIdentifier}`, "page");
}

export function revalidateShop(shopSlug: string) {
  revalidateTag(CACHE_TAGS.SHOP, "max");
  revalidateTag(safeTag(`${CACHE_TAGS.SHOP}-${shopSlug}`), "max");
  revalidateTag(CACHE_TAGS.SHOPS, "max");
  revalidatePath(`/${shopSlug}`, "page");
  revalidatePath("/vendors", "page");
}

export function revalidateCart(cartId: string) {
  revalidateTag(CACHE_TAGS.CART, "max");
  revalidateTag(safeTag(`${CACHE_TAGS.CART}-${cartId}`), "max");
  revalidatePath("/cart", "page");
}

export function revalidateAllProducts() {
  revalidateTag(CACHE_TAGS.PRODUCTS, "max");
  revalidatePath("/products", "page");
  revalidatePath("/", "page");
}

export function revalidateAllShops() {
  revalidateTag(CACHE_TAGS.SHOPS, "max");
  revalidatePath("/vendors", "page");
}
