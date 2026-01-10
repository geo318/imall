import { Suspense } from "react";
import { Footer } from "@/components/footer/footer";
import { MarketingNav } from "@/components/marketing-nav";
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
 */
export async function ProductServer({ productIdentifier }: Props) {
  // Fetch product data on server with caching
  const product = await getProductByIdentifierServer(productIdentifier);
  const shopSlug = product.tenantSlug ?? "demo-shop";

  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />
      <main className="flex-1">
        <ProductDetailClient product={product} productIdentifier={productIdentifier} />
        {/* Similar Products Section - rendered at server level to avoid fetch waterfall */}
        <Suspense fallback={<ProductGridSkeleton count={4} />}>
          <SimilarProductsServer currentProductId={product.id} shopSlug={shopSlug} limit={4} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
