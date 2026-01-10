import { Suspense } from "react";
import { Footer } from "@/components/footer/footer";
import { MarketingNav } from "@/components/marketing-nav";
import { getShopsServer } from "@/lib/server/shops";
import { VendorsContentSkeleton } from "./_components/vendors-content";
import { VendorsSearch } from "./_components/vendors-search";

export const metadata = {
  title: "Vendors | MarketHub",
  description: "Discover trusted sellers from around the world",
};

// PPR: Static shell with dynamic vendors list slot
export default async function VendorsPage() {
  // Fetch shops on the server (this is a dynamic slot)
  const shops = await getShopsServer(50);

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <main className="container py-8">
        {/* Static: Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Our Vendors</h1>
          <p className="text-slate-600 text-lg">Discover trusted sellers from around the world</p>
        </div>

        {/* Dynamic slot: Vendors search/filter with Suspense boundary */}
        <Suspense fallback={<VendorsContentSkeleton />}>
          <VendorsSearch shops={shops} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
