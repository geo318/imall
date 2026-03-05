import { Button } from "@repo/ui/button";
import { CategoryBanner } from "@/components/marketing/category-banner";
import { FeaturedProductsServer } from "@/components/marketing/featured-products-server";
import { HeroSection } from "@/components/marketing/hero";
import { VendorSpotlight } from "@/components/marketing/vendor-spotlight";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";

export const metadata = {
  title: "MarketHub - Modern Multi-Vendor Marketplace",
  description: "Discover products from verified vendors. Shop now or bid in auctions.",
};

// PPR: Static shell with dynamic content slots
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const localeValue = locale as Locale;
  const t = await getTranslations(localeValue);
  const valueProps = t.raw("home.valueProps") as Array<{ title: string; body: string }>;
  const vendorFeatures = t.raw("home.forVendors.features") as string[];

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
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/35 to-sky-50/35 p-7 shadow-sm sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-sm font-semibold tracking-tight text-emerald-700">
                {t("home.why.tag")}
              </p>
              <h3 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                {t("home.why.title")}
              </h3>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600">
                {t("home.why.description")}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {valueProps.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm"
                  >
                    <h4 className="text-base font-semibold leading-snug text-slate-900">{item.title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-sm">
              <h4 className="text-lg font-semibold text-slate-900">{t("home.forVendors.title")}</h4>
              <ul className="list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-slate-600 marker:text-emerald-500">
                {vendorFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
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
