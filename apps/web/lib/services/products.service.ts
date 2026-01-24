import axios from "axios";
import type { Product } from "@/lib/types/products";
import { tryCatch } from "../utils";

export type ProductSearchParams = {
  limit?: number;
  offset?: number;
  q?: string; // Backend expects 'q', not 'query'
  type?: "all" | "buyNow" | "auction";
  sort?: "newest" | "oldest" | "priceAsc" | "priceDesc" | "random";
  minPrice?: number;
  maxPrice?: number;
};

export type ProductSearchResponse = {
  items: Product[];
  nextOffset: number | null;
};

export async function getShopProducts(shopSlug: string, limit = 20): Promise<Product[]> {
  const [data, error] = await tryCatch(
    axios.get<Product[]>(`/api/shops/${shopSlug}/products`, {
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
  const [data, error] = await tryCatch(
    axios.get<ProductSearchResponse>(`/api/shops/${shopSlug}/products`, {
      params,
    }),
  );

  if (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to search shop products");
  }

  return data.data;
}

export async function getProductByIdentifier(productIdentifier: string): Promise<Product> {
  const [data, error] = await tryCatch(axios.get<Product>(`/api/products/${productIdentifier}`));

  if (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load product");
  }

  return data.data;
}

export async function getProductBySlug(shopSlug: string, productSlug: string): Promise<Product> {
  const [data, error] = await tryCatch(
    axios.get<Product>(`/api/shops/${shopSlug}/products/${productSlug}`),
  );

  if (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error("not-found");
    }
    throw new Error("Failed to load product");
  }

  return data.data;
}

export async function getAnyProducts(limit = 20): Promise<Product[]> {
  const [data, error] = await tryCatch(
    axios.get<Product[]>("/api/products", {
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
