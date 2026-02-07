import { Button } from "@repo/ui/button";
import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.server";
import { CategoryBanner } from "@/components/marketing/category-banner";
import { FeaturedProductsServer } from "@/components/marketing/featured-products-server";
import { HeroSection } from "@/components/marketing/hero";
import { VendorSpotlight } from "@/components/marketing/vendor-spotlight";

export const metadata = {
  title: "MarketHub - Modern Multi-Vendor Marketplace",
  description: "Discover products from verified vendors. Shop now or bid in auctions.",
};

// PPR: Static shell with dynamic content slots
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);
  const valueProps = t.raw("home.valueProps") as Array<{ title: string; body: string }>;
  const vendorFeatures = t.raw("home.forVendors.features") as string[];

  return (
    <div className="bg-white">
      {/* Static: Hero section */}
      <HeroSection />
      {/* Dynamic slot: Featured products */}
      <FeaturedProductsServer />
      {/* Static: Category banner */}
      <CategoryBanner />
      {/* Dynamic slot: Vendor spotlight */}
      <VendorSpotlight />
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/40 p-8 shadow-sm sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                {t("home.why.tag")}
              </p>
              <h3 className="text-3xl font-semibold text-slate-900">
                {t("home.why.title")}
              </h3>
              <p className="text-slate-600">{t("home.why.description")}</p>
              <div className="grid gap-4 sm:grid-cols-3">
                {valueProps.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"
                  >
                    <h4 className="text-base font-semibold text-slate-900">{item.title}</h4>
                    <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h4 className="text-lg font-semibold text-slate-900">
                {t("home.forVendors.title")}
              </h4>
              <ul className="space-y-3 text-sm text-slate-600">
                {vendorFeatures.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Link href="/sell" prefetch>
                  <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                    {t("nav.startSelling")}
                  </Button>
                </Link>
                <Link href="/sell" prefetch>
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    {t("home.forVendors.openAdmin")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
