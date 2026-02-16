"use server";

import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";
import { cacheLife, cacheTag, unstable_noStore as noStore } from "next/cache";
import { redirect } from "@/i18n/navigation.server";
import { CACHE_TAGS } from "@/lib/constants";

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
  const token = options.token !== undefined ? options.token : await getAuthToken();
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

export type Shop = {
  id: string;
  slug: string;
  name: string;
};

export type MyShop = Shop & {
  canSell?: boolean;
  role?: string | null;
};

export type ShopProfile = Shop & {
  sellerEmail?: string | null;
  sellerPhone?: string | null;
  sellerRules?: string | null;
};

/**
 * Get list of shops
 * Cached for PPR - public data, no auth required
 */
export async function getShops(limit = 50): Promise<Shop[]> {
  "use cache";
  cacheLife({ stale: 300, expire: 3600 }); // 5m stale, 1h expire
  cacheTag(CACHE_TAGS.SHOPS);

  // Public endpoint - no auth token needed
  const response = await backendRequest("/shops", {
    params: { limit },
    token: null, // Explicitly no token for public data
  });

  if (!response.ok) {
    throw new Error("Failed to load shops");
  }

  return response.json();
}

/**
 * Get shops for current authenticated user
 */
export async function getMyShops(): Promise<MyShop[]> {
  const response = await backendRequest("/shops/mine");
  if (!response.ok) {
    throw new Error("Failed to load your shops");
  }
  return response.json();
}

/**
 * Get public profile data for a shop
 * Cached for PPR - public data, no auth required
 */
export async function getShopProfile(shopSlug: string): Promise<ShopProfile | null> {
  noStore();

  const response = await backendRequest(`/shops/${shopSlug}/profile`, {
    token: null,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load shop profile");
  }

  return response.json();
}

/**
 * Register a new shop for the current user
 */
export async function registerShop(_prevState: { error?: string } | undefined, formData: FormData) {
  const name = String(formData.get("name") || "").trim();

  if (!name) {
    return { error: "Shop name is required" };
  }

  try {
    const response = await backendRequest("/shops/register", {
      method: "POST",
      body: { name },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData?.error ?? "Failed to register shop" };
    }

    const data = (await response.json()) as { slug?: string };
    if (!data?.slug) {
      return { error: "Failed to register shop" };
    }

    return redirect(`/admin/${data.slug}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to register shop" };
  }
}
