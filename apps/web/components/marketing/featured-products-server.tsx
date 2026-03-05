import { Suspense } from "react";
import { getCurrentLocale } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { getAnyProductsServer } from "@/lib/server/products";
import { ProductGridSkeleton } from "../skeletons/product-card-skeleton";
import { FeaturedProducts } from "./featured-products";
import type { MarketingProduct } from "./product-card";

async function FeaturedProductsContent({
  limit = 24,
  emptyText,
}: Readonly<{ limit?: number; emptyText: string }>) {
  "use cache";
  const data = await getAnyProductsServer(limit);
  const products: MarketingProduct[] = data.map((product) => mapApiProductToMarketing(product));

  // Home rule: first 4 buy-now, next 4 auctions (if available).
  const buyNow = products.filter((p) => !p.isAuction);
  const auctions = products.filter((p) => p.isAuction);
  const curated = [...buyNow.slice(0, 4), ...auctions.slice(0, 4)];
  // If auctions are missing, fill remaining slots from buy-now.
  while (curated.length < 8 && buyNow[curated.length]) {
    const product = buyNow[curated.length];

    if (product) {
      curated.push(product);
    }
  }

  if (products.length === 0) {
    return (
      <section className="py-14 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-slate-500">{emptyText}</p>
        </div>
      </section>
    );
  }

  return <FeaturedProducts products={curated.slice(0, 8)} />;
}

export async function FeaturedProductsServer({ limit = 24 }: Readonly<{ limit?: number }>) {
  const locale = await getCurrentLocale();
  const t = await getTranslations(locale);

  return (
    <Suspense
      fallback={
        <section className="py-14 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ProductGridSkeleton count={8} />
          </div>
        </section>
      }
    >
      <FeaturedProductsContent limit={limit} emptyText={t("featuredProducts.empty")} />
    </Suspense>
  );
}
