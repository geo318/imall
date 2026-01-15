"use server";

import { env } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "../constants";
import type {
  ApiProduct,
  ProductSearchParams,
  ProductSearchResponse,
} from "../services/products.service";

const API_BASE = env.BACKEND_URL || "http://localhost:3001";

/**
 * Server-side function to fetch products for a shop
 * Uses Cache Components with 'use cache' directive for PPR
 */
export async function getShopProductsServer(shopSlug: string, limit = 20): Promise<ApiProduct[]> {
  "use cache";
  cacheLife({ stale: 60, expire: 3600 }); // 1m stale, 1h expire
  cacheTag(CACHE_TAGS.PRODUCTS);
  cacheTag(`${CACHE_TAGS.SHOP}-${shopSlug}`);

  const response = await fetch(`${API_BASE}/api/shops/${shopSlug}/products?limit=${limit}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load products");
  }

  return response.json();
}

/**
 * Server-side function to fetch a product by identifier
 * Uses Cache Components with 'use cache' directive for PPR
 */
export async function getProductByIdentifierServer(productIdentifier: string): Promise<ApiProduct> {
  "use cache";
  cacheLife({ stale: 30, expire: 1800 }); // 30s stale, 30m expire
  cacheTag(CACHE_TAGS.PRODUCT);
  cacheTag(`${CACHE_TAGS.PRODUCT}-${productIdentifier}`);

  const response = await fetch(`${API_BASE}/api/products/${productIdentifier}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load product");
  }

  return response.json();
}

/**
 * Server-side function to search products
 * Uses Cache Components with 'use cache' directive for PPR
 */
export async function searchProductsServer(
  params: ProductSearchParams,
): Promise<ProductSearchResponse> {
  "use cache";
  cacheLife({ stale: 60, expire: 300 }); // 1m stale, 5m expire
  cacheTag(CACHE_TAGS.PRODUCTS);

  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.type) searchParams.set("type", params.type);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.minPrice !== undefined) searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice !== undefined) searchParams.set("maxPrice", String(params.maxPrice));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  const response = await fetch(`${API_BASE}/api/products/search?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to search products");
  }

  return response.json();
}

/**
 * Server-side function to fetch random products
 * Uses Cache Components with 'use cache' directive for PPR
 */
export async function getAnyProductsServer(limit = 20): Promise<ApiProduct[]> {
  "use cache";
  cacheLife({ stale: 60, expire: 300 }); // 1m stale, 5m expire
  cacheTag(CACHE_TAGS.PRODUCTS);

  const response = await fetch(`${API_BASE}/api/products?limit=${limit}`);

  if (!response.ok) {
    if (response.status === 404) {
      // Fallback to shop products
      return getShopProductsServer(env.SEED_SHOP_SLUG, limit);
    }
    throw new Error("Failed to load products");
  }

  return response.json();
}
