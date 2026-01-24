"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { ProductGridSkeleton } from "@/components/skeletons/product-card-skeleton";
import type { ApiProduct } from "@/lib/api/products";
import { ProductDetailClient } from "./product-detail-client";

type Props = {
  productIdentifier: string;
};

/**
 * Client component that fetches product with auth token
 * Used as fallback when server fetch fails (e.g., for deleted/draft products)
 */
export function ProductFetcherClient({ productIdentifier }: Props) {
  const { getToken } = useAuth();

  const {
    data: product,
    isLoading,
    error,
  } = useQuery<ApiProduct>({
    queryKey: ["product-with-auth", productIdentifier],
    queryFn: async () => {
      const token = await getToken();
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/products/${productIdentifier}`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("not-found");
        }
        throw new Error("Failed to load product");
      }

      return response.json();
    },
    retry: false,
  });

  if (isLoading) {
    return <ProductGridSkeleton count={1} />;
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">404 - Product Not Found</h1>
          <p className="text-slate-600">
            The product you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return <ProductDetailClient product={product} productIdentifier={productIdentifier} />;
}
