import { Suspense } from "react";
import { Footer } from "@/components/footer/footer";
import { MarketingNav } from "@/components/marketing-nav";
import { ProductGridSkeleton } from "@/components/skeletons/product-card-skeleton";
import { ProductsExplorerClient } from "./_components/products-explorer-client";

export const metadata = {
  title: "Products | MarketHub",
  description: "Browse our curated collection of products from verified vendors",
};

// PPR: Static shell with dynamic products explorer slot
export default async function ProductsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingNav />
      <main className="flex-1">
        {/* Static: Page Header */}
        <div className="bg-gradient-hero py-12">
          <div className="container">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Browse <span className="text-gradient">Products</span>
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Explore our curated collection from verified vendors.
            </p>
          </div>
        </div>

        {/* Dynamic slot: Products explorer with Suspense boundary */}
        <Suspense
          fallback={
            <div className="container py-8">
              <ProductGridSkeleton count={12} />
            </div>
          }
        >
          <ProductsExplorerClient />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
