import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { ProductsExplorerClient } from "./ProductsExplorerClient";

export default async function ProductsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingNav />
      <main className="flex-1">
        {/* Page Header */}
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

        <ProductsExplorerClient />
      </main>
      <MarketingFooter />
    </div>
  );
}
