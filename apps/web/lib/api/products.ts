import { env } from "@repo/shared";

export type ApiProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tenantSlug?: string;
  tenantName?: string;
  variants: {
    id: string;
    sku: string | null;
    price: string;
    currency: string;
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
    } | null;
  }[];
};

export async function fetchShopProducts(shopSlug: string, limit = 20): Promise<ApiProduct[]> {
  const res = await fetch(
    `${env.NEXT_PUBLIC_DOMAIN}/api/shops/${shopSlug}/products?limit=${limit}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error("Failed to load products");
  }
  return (await res.json()) as ApiProduct[];
}

export async function fetchProductBySlug(
  shopSlug: string,
  productSlug: string,
): Promise<ApiProduct> {
  const res = await fetch(
    `${env.NEXT_PUBLIC_DOMAIN}/api/shops/${shopSlug}/products/${productSlug}`,
    { cache: "no-store" },
  );
  if (res.status === 404) {
    throw new Error("not-found");
  }
  if (!res.ok) {
    throw new Error("Failed to load product");
  }
  return (await res.json()) as ApiProduct;
}

export async function fetchAnyProducts(limit = 20): Promise<ApiProduct[]> {
  const res = await fetch(`${env.NEXT_PUBLIC_DOMAIN}/api/products?limit=${limit}`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    // Fallback for environments where the random products endpoint is not deployed yet.
    return fetchShopProducts(env.SEED_SHOP_SLUG, limit);
  }

  if (!res.ok) {
    throw new Error("Failed to load products");
  }
  return (await res.json()) as ApiProduct[];
}
