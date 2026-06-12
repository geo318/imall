import { env } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "../constants";

const API_BASE = env.BACKEND_URL || "http://localhost:3001";

export type Shop = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Server-side function to fetch shops
 * Uses Cache Components with 'use cache' directive for PPR
 */
export async function getShopsServer(limit = 50): Promise<Shop[]> {
  "use cache";
  cacheLife({ stale: 120, expire: 300 }); // 2m stale, 5m expire
  cacheTag(CACHE_TAGS.SHOPS);

  try {
    const response = await fetch(`${API_BASE}/api/shops?limit=${limit}`);
    if (!response.ok) {
      return [];
    }
    return response.json();
  } catch (error) {
    console.warn("Failed to fetch shops:", error);
    return [];
  }
}
