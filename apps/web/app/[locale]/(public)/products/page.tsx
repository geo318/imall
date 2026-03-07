import { Suspense } from "react";
import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { ProductsWithSidebarSkeleton } from "@/components/skeletons/products-with-sidebar-skeleton";
import { ProductsExplorerClient } from "./_components/products-explorer-client";

export const metadata = {
  title: "Products | MarketHub",
  description: "Browse our curated collection of products from verified vendors",
};

// PPR: Static shell with dynamic products explorer slot
export default async function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);
  return (
    <>
      {/* Static: Page Header */}
      <div className="bg-gradient-hero py-12">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t.rich("products.title", {
              highlight: (chunks) => <span key={chunks?.toString()} className="text-gradient">{chunks}</span>,
            })}
          </h1>
          <p className="text-muted-foreground max-w-xl">{t("products.subtitle")}</p>
        </div>
      </div>

      {/* Dynamic slot: Products explorer with Suspense boundary */}
      <Suspense
        fallback={
          <div className="container py-8">
            <ProductsWithSidebarSkeleton count={12} />
          </div>
        }
      >
        <ProductsExplorerClient />
      </Suspense>
    </>
  );
}
