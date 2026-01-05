"use client";

import type { MarketingProduct } from "@/components/marketing/product-card";
import { fetchAnyProducts } from "@/lib/api/products";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { useQuery } from "@tanstack/react-query";
import { FeaturedProducts } from "./featured-products";

type Props = {
  limit?: number;
};

export function FeaturedProductsClient({ limit = 8 }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["featured-products", limit],
    queryFn: () => fetchAnyProducts(limit),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <section className="py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-slate-500">Loading featured products…</p>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-red-600">
            Failed to load products. Make sure the API is running.
          </p>
        </div>
      </section>
    );
  }

  const products: MarketingProduct[] = data.map((product) => mapApiProductToMarketing(product));

  if (products.length === 0) {
    return (
      <section className="py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-slate-500">No products yet for this shop.</p>
        </div>
      </section>
    );
  }

  return <FeaturedProducts products={products} />;
}
