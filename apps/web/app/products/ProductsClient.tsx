"use client";

import { ProductCard } from "@/components/marketing/product-card";
import { fetchAnyProducts } from "@/lib/api/products";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { useQuery } from "@tanstack/react-query";

type Props = {
  limit?: number;
};

export function ProductsClient({ limit = 20 }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", "any", limit],
    queryFn: () => fetchAnyProducts(limit),
    staleTime: 30_000,
  });

  if (isLoading) {
    return <p className="text-center text-slate-500">Loading products…</p>;
  }

  if (isError || !data) {
    return (
      <p className="text-center text-red-600">
        Failed to load products. Make sure the API is running.
      </p>
    );
  }

  const products = data.map((product) => mapApiProductToMarketing(product));

  if (products.length === 0) {
    return <p className="text-center text-slate-500">No products found for this shop.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}
