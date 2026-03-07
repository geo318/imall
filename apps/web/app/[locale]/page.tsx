import { CategoryBanner } from "@/components/marketing/category-banner";
import { FeaturedProductsServer } from "@/components/marketing/featured-products-server";
import { HeroSection } from "@/components/marketing/hero";
import { VendorSpotlight } from "@/components/marketing/vendor-spotlight";
import { WhyImall } from "@/components/marketing/why-imall";
import type { Locale } from "@/i18n/config";

export const metadata = {
  title: "MarketHub - Modern Multi-Vendor Marketplace",
  description: "Discover products from verified vendors. Shop now or bid in auctions.",
};

// PPR: Static shell with dynamic content slots
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const localeValue = locale as Locale;

  return (
    <div className="bg-white">
      {/* Static: Hero section */}
      <HeroSection locale={localeValue} />
      <div className="pointer-events-none -mt-14 h-16 bg-gradient-to-b from-emerald-100/60 via-white/90 to-white" />
      {/* Dynamic slot: Featured products */}
      <div className="render-budget-section">
        <FeaturedProductsServer />
      </div>
      {/* Static: Category banner */}
      <div className="render-budget-section">
        <CategoryBanner />
      </div>
      {/* Dynamic slot: Vendor spotlight */}
      <div className="render-budget-section">
        <VendorSpotlight />
      </div>
      <WhyImall locale={localeValue} />
    </div>
  );
}
