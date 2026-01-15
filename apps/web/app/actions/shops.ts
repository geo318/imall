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

export type Shop = {
  id: string;
  slug: string;
  name: string;
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
