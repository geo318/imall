import { Suspense } from "react";
import { ProductCard } from "@/components/marketing/product-card";
import { ProductGridSkeleton } from "@/components/skeletons/product-card-skeleton";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { getShopProductsServer } from "@/lib/server/products";

type Props = {
  shopSlug: string;
};

async function ShopProductsContent({ shopSlug }: Props) {
  const data = await getShopProductsServer(shopSlug, 20);
  const products = data.map((product) => mapApiProductToMarketing(product));

  if (products.length === 0) {
    return <p className="text-center text-slate-500">No products found for this shop.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} {...product} />
      ))}
    </div>
  );
}

export function ShopProducts({ shopSlug }: Props) {
  return (
    <Suspense fallback={<ProductGridSkeleton count={8} />}>
      <ShopProductsContent shopSlug={shopSlug} />
    </Suspense>
  );
}
