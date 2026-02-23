"use server";

import { env } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/constants";
import type { Product } from "@/lib/types/products";

/**
 * Public backend request helper for cached product reads.
 * Keep this auth-free so Cache Components never touch request-bound APIs.
 */
async function backendRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    params?: Record<string, string | number | undefined>;
  } = {},
): Promise<Response> {
  const url = new URL(`${env.BACKEND_URL}/api${path}`);

  // Add query params
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return response;
}

export type ProductSearchParams = {
  limit?: number;
  offset?: number;
  q?: string;
  type?: "all" | "buyNow" | "auction";
  sort?: "newest" | "oldest" | "priceAsc" | "priceDesc" | "random";
  minPrice?: number;
  maxPrice?: number;
};

export type ProductSearchResponse = {
  items: Product[];
  nextOffset: number | null;
};

/**
 * Get products for a specific shop
 * Cached for PPR - public data, no auth required
 */
export async function getShopProducts(shopSlug: string, limit = 20): Promise<Product[]> {
  "use cache";
  cacheLife({ stale: 60, expire: 3600 }); // 1m stale, 1h expire
  cacheTag(CACHE_TAGS.PRODUCTS);
  cacheTag(`${CACHE_TAGS.SHOP}-${shopSlug}`);

  // Public endpoint - no auth token needed
  const response = await backendRequest(`/shops/${shopSlug}/products`, {
    params: { limit },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load products");
  }

  return response.json();
}

/**
 * Search products for a specific shop with pagination and filtering
 * Cached for PPR - public data, no auth required
 */
export async function searchShopProducts(
  shopSlug: string,
  params: {
    limit?: number;
    offset?: number;
    q?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: "newest" | "oldest" | "priceAsc" | "priceDesc";
  },
): Promise<ProductSearchResponse> {
  "use cache";
  cacheLife({ stale: 60, expire: 300 }); // 1m stale, 5m expire
  cacheTag(CACHE_TAGS.PRODUCTS);
  cacheTag(`${CACHE_TAGS.SHOP}-${shopSlug}`);

  // Public endpoint - no auth token needed
  const response = await backendRequest(`/shops/${shopSlug}/products`, {
    params: {
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      sort: params.sort,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to search shop products");
  }

  return response.json();
}

/**
 * Get product by identifier (slug + short ID)
 * Cached for PPR - public data, no auth required
 */
export async function getProductByIdentifier(productIdentifier: string): Promise<Product> {
  "use cache";
  cacheLife({ stale: 30, expire: 1800 }); // 30s stale, 30m expire
  cacheTag(CACHE_TAGS.PRODUCT);
  cacheTag(`${CACHE_TAGS.PRODUCT}-${productIdentifier}`);

  // Public endpoint - no auth token needed
  const response = await backendRequest(`/products/${productIdentifier}`, {
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load product");
  }

  return response.json();
}

/**
 * Get product by shop slug and product slug
 * Cached for PPR - public data, no auth required
 */
export async function getProductBySlug(shopSlug: string, productSlug: string): Promise<Product> {
  "use cache";
  cacheLife({ stale: 30, expire: 1800 }); // 30s stale, 30m expire
  cacheTag(CACHE_TAGS.PRODUCT);
  cacheTag(`${CACHE_TAGS.SHOP}-${shopSlug}`);

  // Public endpoint - no auth token needed
  const response = await backendRequest(`/shops/${shopSlug}/products/${productSlug}`, {
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load product");
  }

  return response.json();
}

/**
 * Get random products
 * Cached for PPR - public data, no auth required
 */
export async function getAnyProducts(limit = 20): Promise<Product[]> {
  "use cache";
  cacheLife({ stale: 60, expire: 300 }); // 1m stale, 5m expire
  cacheTag(CACHE_TAGS.PRODUCTS);

  // Public endpoint - no auth token needed
  const response = await backendRequest("/products", {
    params: { limit },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Fallback for environments where the random products endpoint is not deployed yet.
      const { env } = await import("@repo/shared");
      return getShopProducts(env.SEED_SHOP_SLUG, limit);
    }
    throw new Error("Failed to load products");
  }

  return response.json();
}

/**
 * Search products
 * Cached for PPR - public data, no auth required
 */
export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResponse> {
  "use cache";
  cacheLife({ stale: 60, expire: 300 }); // 1m stale, 5m expire
  cacheTag(CACHE_TAGS.PRODUCTS);

  const response = await backendRequest("/products/search", {
    params: {
      limit: params.limit,
      offset: params.offset,
      q: params.q,
      type: params.type,
      sort: params.sort,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to search products");
  }

  return response.json();
}
