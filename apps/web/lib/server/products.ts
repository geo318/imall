import "server-only";

import { env } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import type { Product } from "@/lib/types/products";
import { CACHE_TAGS, safeTag } from "../constants";
import type { ProductSearchParams, ProductSearchResponse } from "../services/products.service";

const DEFAULT_BACKEND_TIMEOUT_MS = 8_000;

function resolveBackendBase() {
  const raw = env.BACKEND_URL || "http://localhost:3001";
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `http://${raw}`;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function fetchBackend(path: string, init: RequestInit = {}): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_BACKEND_TIMEOUT_MS);

  try {
    return await fetch(`${resolveBackendBase()}${normalizedPath}`, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("backend-timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Server-side function to fetch products for a shop
 * Uses Cache Components with 'use cache' directive for PPR
 */
export async function getShopProductsServer(shopSlug: string, limit = 20): Promise<Product[]> {
  "use cache";
  cacheLife({ stale: 30, expire: 120 }); // 30s stale, 2m expire
  cacheTag(CACHE_TAGS.PRODUCTS);
  cacheTag(safeTag(`${CACHE_TAGS.SHOP}-${shopSlug}`));

  try {
    const response = await fetchBackend(`/api/shops/${shopSlug}/products?limit=${limit}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("not-found");
      }
      return [];
    }
    const data = await response.json();
    // Handle both old format (array) and new format ({ items, nextOffset })
    return Array.isArray(data) ? data : data.items || [];
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      throw error;
    }
    console.warn("Failed to fetch shop products:", error);
    return [];
  }
}

/**
 * Server-side function to fetch a product by identifier
 * Uses Cache Components with 'use cache' directive for PPR
 */
export async function getProductByIdentifierServer(productIdentifier: string): Promise<Product> {
  "use cache";
  cacheLife({ stale: 30, expire: 120 }); // 30s stale, 2m expire
  cacheTag(CACHE_TAGS.PRODUCT);
  cacheTag(safeTag(`${CACHE_TAGS.PRODUCT}-${productIdentifier}`));

  const response = await fetchBackend(`/api/products/${productIdentifier}`);

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
  cacheLife({ stale: 20, expire: 60 }); // 20s stale, 1m expire — high cardinality
  cacheTag(CACHE_TAGS.PRODUCTS);

  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.type) searchParams.set("type", params.type);
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.minPrice !== undefined) searchParams.set("minPrice", String(params.minPrice));
  if (params.maxPrice !== undefined) searchParams.set("maxPrice", String(params.maxPrice));
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));

  try {
    const response = await fetchBackend(`/api/products/search?${searchParams.toString()}`);
    if (!response.ok) {
      return { items: [], nextOffset: null };
    }
    return response.json();
  } catch (error) {
    console.warn("Failed to search products:", error);
    return { items: [], nextOffset: null };
  }
}

/**
 * Server-side function to fetch random products
 * Uses Cache Components with 'use cache' directive for PPR
 */
export async function getAnyProductsServer(limit = 20): Promise<Product[]> {
  "use cache";
  cacheLife({ stale: 60, expire: 300 }); // 1m stale, 5m expire
  cacheTag(CACHE_TAGS.PRODUCTS);

  try {
    const response = await fetchBackend(`/api/products?limit=${limit}`);
    if (!response.ok) {
      if (response.status === 404) {
        try {
          return await getShopProductsServer(env.SEED_SHOP_SLUG, limit);
        } catch {
          return [];
        }
      }
      return [];
    }
    return response.json();
  } catch (error) {
    console.warn("Failed to fetch products:", error);
    try {
      return await getShopProductsServer(env.SEED_SHOP_SLUG, limit);
    } catch {
      return [];
    }
  }
}
