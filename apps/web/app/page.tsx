import { valuePropsMock } from "@/MOCKS/valueProps.mock";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { CategoryBanner } from "@/components/marketing/category-banner";
import { FeaturedProductsClient } from "@/components/marketing/featured-products-client";
import { HeroSection } from "@/components/marketing/hero";
import { VendorSpotlight } from "@/components/marketing/vendor-spotlight";
import { Button } from "@repo/ui/button";
import Link from "next/link";

export default async function Home() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <main>
        <HeroSection />
        <FeaturedProductsClient />
        <CategoryBanner />
        <VendorSpotlight />
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/40 p-8 shadow-sm sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
              <div className="space-y-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                  Why MarketHub
                </p>
                <h3 className="text-3xl font-semibold text-slate-900">
                  Built for marketplaces that need trust, speed, and flexibility.
                </h3>
                <p className="text-slate-600">
                  Multi-tenant shops, auctions when you need them, and a shared admin space that
                  keeps everything running smoothly.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {valuePropsMock.map((item) => (
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
                <h4 className="text-lg font-semibold text-slate-900">For vendors</h4>
                <ul className="space-y-3 text-sm text-slate-600">
                  <li>• List products or run auctions with minimal setup.</li>
                  <li>• Manage inventory, payouts, and orders from one workspace.</li>
                  <li>• Built-in buyer messaging and trust signals coming soon.</li>
                </ul>
                <div className="flex gap-3">
                  <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <Link href="/vendors" prefetch>
                      Start selling
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Link href="/admin/demo-shop" prefetch>
                      Open admin
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
