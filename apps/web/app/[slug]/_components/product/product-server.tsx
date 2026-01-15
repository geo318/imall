import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/skeletons/product-card-skeleton";
import { getProductByIdentifierServer } from "@/lib/server/products";
import { ProductDetailClient } from "./product-detail-client";
import { SimilarProductsServer } from "./similar-products-server";

type Props = {
  productIdentifier: string;
};

/**
 * Server component that fetches product data with Cache Components
 * Most of the UI is static, only dynamic parts use Suspense
 * Note: Caching is handled in getProductByIdentifierServer, not here
 */
export async function ProductServer({ productIdentifier }: Props) {
  // Fetch product data on server with caching (caching handled in getProductByIdentifierServer)
  const product = await getProductByIdentifierServer(productIdentifier);
  const shopSlug = product.tenantSlug ?? "demo-shop";

  return (
    <>
      <ProductDetailClient product={product} productIdentifier={productIdentifier} />
      {/* Similar Products Section - rendered at server level to avoid fetch waterfall */}
      <Suspense fallback={<ProductGridSkeleton count={4} />}>
        <SimilarProductsServer currentProductId={product.id} shopSlug={shopSlug} limit={4} />
      </Suspense>
    </>
  );
}
