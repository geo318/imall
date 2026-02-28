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
  categories?: string[];
};

export type ProductSearchResponse = {
  items: Product[];
  nextOffset: number | null;
};

const backendBase =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL
    ? process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/+$/, "")
    : "";
const apiBase = backendBase ? `${backendBase}/api` : "/api";

export async function getShopProducts(shopSlug: string, limit = 20): Promise<Product[]> {
  const [data, error] = await tryCatch(
    axios.get<Product[]>(`${apiBase}/shops/${shopSlug}/products`, {
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
    categories?: string[];
  },
): Promise<ProductSearchResponse> {
  const normalizedParams = {
    ...params,
    categories: params.categories?.join(","),
  };

  const [data, error] = await tryCatch(
    axios.get<ProductSearchResponse>(`${apiBase}/shops/${shopSlug}/products`, {
      params: normalizedParams,
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
  const [data, error] = await tryCatch(
    axios.get<Product>(`${apiBase}/products/${productIdentifier}`),
  );

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
    axios.get<Product>(`${apiBase}/shops/${shopSlug}/products/${productSlug}`),
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
    axios.get<Product[]>(`${apiBase}/products`, {
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
  const normalizedParams = {
    ...params,
    categories: params.categories?.join(","),
  };

  const [data, error] = await tryCatch(
    axios.get<ProductSearchResponse>(`${apiBase}/products/search`, { params: normalizedParams }),
  );

  if (error) {
    throw new Error("Failed to search products");
  }

  return data.data;
}
