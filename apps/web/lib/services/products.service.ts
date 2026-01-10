import axios from "axios";
import { tryCatch } from "../utils";

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

export async function getShopProducts(shopSlug: string, limit = 20): Promise<ApiProduct[]> {
  const [data, error] = await tryCatch(
    axios.get<ApiProduct[]>(`/api/shops/${shopSlug}/products`, {
      params: { limit },
    }),
  );

  if (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load products");
  }

  return data.data;
}

export async function getProductByIdentifier(productIdentifier: string): Promise<ApiProduct> {
  const [data, error] = await tryCatch(
    axios.get<ApiProduct>(`/api/products/${productIdentifier}`),
  );

  if (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load product");
  }

  return data.data;
}

export async function getProductBySlug(
  shopSlug: string,
  productSlug: string,
): Promise<ApiProduct> {
  const [data, error] = await tryCatch(
    axios.get<ApiProduct>(`/api/shops/${shopSlug}/products/${productSlug}`),
  );

  if (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load product");
  }

  return data.data;
}

export async function getAnyProducts(limit = 20): Promise<ApiProduct[]> {
  const [data, error] = await tryCatch(
    axios.get<ApiProduct[]>("/api/products", {
      params: { limit },
    }),
  );

  if (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // Fallback for environments where the random products endpoint is not deployed yet.
      const { env } = await import("@repo/shared");
      return getShopProducts(env.SEED_SHOP_SLUG, limit);
    }
    throw new Error("Failed to load products");
  }

  return data.data;
}

export async function searchProducts(params: ProductSearchParams): Promise<ProductSearchResponse> {
  const [data, error] = await tryCatch(
    axios.get<ProductSearchResponse>("/api/products/search", { params }),
  );

  if (error) {
    throw new Error("Failed to search products");
  }

  return data.data;
}
