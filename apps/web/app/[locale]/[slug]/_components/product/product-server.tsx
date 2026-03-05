import { Suspense } from "react";
import { ProductGridSkeleton } from "@/components/skeletons/product-card-skeleton";
import type { Locale } from "@/i18n/config";
import { getProductByIdentifierServer } from "@/lib/server/products";
import { ProductDetailClient } from "./product-detail-client";
import { ProductFetcherClient } from "./product-fetcher-client";
import { SimilarProductsServer } from "./similar-products-server";

type Props = {
  productIdentifier: string;
  locale: Locale;
};

/**
 * Server component that fetches product data with Cache Components
 * Most of the UI is static, only dynamic parts use Suspense
 * Note: Caching is handled in getProductByIdentifierServer, not here
 * Falls back to client-side fetch with auth for deleted/draft products
 */
export async function ProductServer({ productIdentifier, locale }: Props) {
  try {
    // Try to fetch product data on server with caching
    const product = await getProductByIdentifierServer(productIdentifier);
    const shopSlug = product.tenantSlug ?? "demo-shop";

    return (
      <>
        <ProductDetailClient product={product} productIdentifier={productIdentifier} />
        {/* Similar Products Section - rendered at server level to avoid fetch waterfall */}
        <Suspense fallback={<ProductGridSkeleton count={4} />}>
          <SimilarProductsServer
            currentProductId={product.id}
            shopSlug={shopSlug}
            limit={4}
            locale={locale}
          />
        </Suspense>
      </>
    );
  } catch (error) {
    // If server fetch fails (e.g., product is deleted/draft), try client-side with auth
    if (error instanceof Error && error.message === "not-found") {
      return (
        <>
          <ProductFetcherClient productIdentifier={productIdentifier} />
          {/* Similar Products - skip for deleted/draft products */}
        </>
      );
    }
    // Re-throw other errors
    throw error;
  }
}
