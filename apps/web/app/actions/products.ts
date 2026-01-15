"use server";

import { auth } from "@clerk/nextjs/server";
import { cacheLife, cacheTag } from "next/cache";
import { env } from "@repo/shared";
import { CACHE_LIFE, CACHE_TAGS } from "@/lib/constants";

/**
 * Helper to get Clerk token for backend requests
 * Must be called outside 'use cache' scope
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return null;
    }

    let token = await authResult.getToken();
    if (!token) {
      try {
        token = await authResult.getToken({
          template: "integration_fallback",
        });
      } catch {
        // Token not available
      }
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Helper to make authenticated backend requests
 * For cached requests, token must be passed as argument (read auth outside cached scope)
 */
async function backendRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    params?: Record<string, string | number | undefined>;
    token?: string | null;
  } = {},
): Promise<Response> {
  // Use provided token or get from auth (outside cached scope)
  const token = options.token ?? (await getAuthToken());
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

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return response;
}

export type ApiProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tenantSlug?: string;
  tenantName?: string;
  createdAt?: string;
  hasAuction?: boolean;
  variants: {
    id: string;
    sku: string | null;
    price: string;
    currency: string;
    availableQty?: number;
    auction?: {
      id: string;
      status: string | null;
      startsAt: string;
      endsAt: string;
      startingBid?: string | null;
      minIncrement?: string | null;
      buyNowPrice?: string | null;
      currentPrice?: string | null;
      highestBidId?: string | null;
      highestBidderId?: string | null;
    } | null;
  }[];
};

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
  items: ApiProduct[];
  nextOffset: number | null;
};

/**
 * Get products for a specific shop
 * Cached for PPR - public data, no auth required
 */
export async function getShopProducts(shopSlug: string, limit = 20): Promise<ApiProduct[]> {
  "use cache";
  cacheLife({ stale: 60, expire: 3600 }); // 1m stale, 1h expire
  cacheTag(CACHE_TAGS.PRODUCTS);
  cacheTag(`${CACHE_TAGS.SHOP}-${shopSlug}`);

  // Public endpoint - no auth token needed
  const response = await backendRequest(`/shops/${shopSlug}/products`, {
    params: { limit },
    token: null, // Explicitly no token for public data
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
 * Get product by identifier (slug + short ID)
 * Cached for PPR - public data, no auth required
 */
export async function getProductByIdentifier(productIdentifier: string): Promise<ApiProduct> {
  "use cache";
  cacheLife({ stale: 30, expire: 1800 }); // 30s stale, 30m expire
  cacheTag(CACHE_TAGS.PRODUCT);
  cacheTag(`${CACHE_TAGS.PRODUCT}-${productIdentifier}`);

  // Public endpoint - no auth token needed
  const response = await backendRequest(`/products/${productIdentifier}`, {
    token: null, // Explicitly no token for public data
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
export async function getProductBySlug(shopSlug: string, productSlug: string): Promise<ApiProduct> {
  "use cache";
  cacheLife({ stale: 30, expire: 1800 }); // 30s stale, 30m expire
  cacheTag(CACHE_TAGS.PRODUCT);
  cacheTag(`${CACHE_TAGS.SHOP}-${shopSlug}`);

  // Public endpoint - no auth token needed
  const response = await backendRequest(`/shops/${shopSlug}/products/${productSlug}`, {
    token: null, // Explicitly no token for public data
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
export async function getAnyProducts(limit = 20): Promise<ApiProduct[]> {
  "use cache";
  cacheLife({ stale: 60, expire: 300 }); // 1m stale, 5m expire
  cacheTag(CACHE_TAGS.PRODUCTS);

  // Public endpoint - no auth token needed
  const response = await backendRequest("/products", {
    params: { limit },
    token: null, // Explicitly no token for public data
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

  // Public endpoint - no auth token needed
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
    token: null, // Explicitly no token for public data
  });

  if (!response.ok) {
    throw new Error("Failed to search products");
  }

  return response.json();
}
