"use server";

import { ProductCard } from "@/components/marketing/product-card";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { getAnyProductsServer, getShopProductsServer } from "@/lib/server/products";

type Props = {
  currentProductId: string;
  shopSlug?: string;
  limit?: number;
  locale: Locale;
};

/**
 * Server component to fetch and display similar products
 * Excludes the current product from the list
 * Uses Cache Components for PPR
 */
export async function SimilarProductsServer({
  currentProductId,
  shopSlug,
  limit = 4,
  locale,
}: Props) {
  "use cache";
  const t = await getTranslations(locale);
  // Fetch products (from same shop if shopSlug provided, otherwise any products)
  const products = shopSlug
    ? await getShopProductsServer(shopSlug, limit + 1)
    : await getAnyProductsServer(limit + 1);

  // Filter out current product and limit results
  const similarProducts = products
    .filter((p) => p.id !== currentProductId)
    .slice(0, limit)
    .map(mapApiProductToMarketing);

  if (similarProducts.length === 0) {
    return null;
  }

  return (
    <section className="mt-16 border-t border-border pt-12">
      <div className="container">
        <h2 className="text-2xl font-bold mb-6">{t("productDetail.similarProducts")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {similarProducts.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </div>
    </section>
  );
}
