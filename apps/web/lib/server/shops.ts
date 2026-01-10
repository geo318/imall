import { env } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_LIFE, CACHE_TAGS } from "../constants";

const API_BASE = env.BACKEND_URL || "http://localhost:3001";

export type Shop = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Server-side function to fetch shops
 * Uses Cache Components with 'use cache' directive
 */
export async function getShopsServer(limit = 50): Promise<Shop[]> {
  "use cache";
  cacheLife(CACHE_LIFE.SHOPS);
  cacheTag(CACHE_TAGS.SHOPS);

  const response = await fetch(`${API_BASE}/api/shops?limit=${limit}`);

  if (!response.ok) {
    throw new Error("Failed to load shops");
  }

  return response.json();
}
