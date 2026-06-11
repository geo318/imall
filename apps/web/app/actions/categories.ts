"use server";

import { env } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/constants";

export type TopCategory = {
  key: string;
  name: string;
  icon: string;
  categorySlug: string | null;
  productCount: number;
};

export async function getTopCategories(limit = 3, locale = "en"): Promise<TopCategory[]> {
  "use cache";
  cacheLife({ stale: 86_400, revalidate: 86_400, expire: 86_400 * 2 });
  cacheTag(CACHE_TAGS.CATEGORIES);

  try {
    const url = new URL(`${env.BACKEND_URL}/api/categories/top`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("locale", locale);

    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return [];

    const payload = (await response.json()) as Array<{
      key?: string;
      name?: string;
      icon?: string;
      categorySlug?: string | null;
      productCount?: number;
    }>;

    return payload
      .filter((item) => item.key)
      .map((item) => ({
        key: item.key!,
        name: item.name ?? item.key!,
        icon: item.icon ?? "📦",
        categorySlug: item.categorySlug ?? null,
        productCount: Number(item.productCount ?? 0),
      }));
  } catch {
    return [];
  }
}
