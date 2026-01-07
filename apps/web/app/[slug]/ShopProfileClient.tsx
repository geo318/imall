"use client";

import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { ProductCard } from "@/components/marketing/product-card";
import { fetchShopProducts } from "@/lib/api/products";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { useQuery } from "@tanstack/react-query";

type Props = {
  shopSlug: string;
  shopName: string;
};

export function ShopProfileClient({ shopSlug, shopName }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["shop-products", shopSlug],
    queryFn: () => fetchShopProducts(shopSlug, 20),
    staleTime: 30_000,
  });

  const products = data ? data.map((product) => mapApiProductToMarketing(product)) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">{shopName}</h1>
          <p className="mt-2 text-slate-600">Shop profile for {shopSlug}</p>
        </div>

        {isLoading && <p className="text-center text-slate-500">Loading products…</p>}
        {isError && (
          <p className="text-center text-red-600">
            Failed to load products. Make sure the API is running.
          </p>
        )}
        {!isLoading && !isError && products.length === 0 && (
          <p className="text-center text-slate-500">No products found for this shop.</p>
        )}
        {!isLoading && !isError && products.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        )}
      </div>
      <MarketingFooter />
    </div>
  );
}

