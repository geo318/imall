import { productCategoriesMock } from "@/MOCKS/productsPage.mock";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { ProductsClient } from "./ProductsClient";
import { Button } from "@repo/ui/button";
import Link from "next/link";

export default async function ProductsPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Shop</p>
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
            Products that stand out
          </h1>
          <p className="mx-auto max-w-3xl text-lg text-slate-600">
            Browse curated picks across categories, or jump straight into auctions for rare finds.
            Everything is sourced from vetted vendors inside the marketplace.
          </p>
          <div className="flex justify-center gap-3">
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/demo-shop" prefetch>
                View demo shop
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Link href="/demo-shop" prefetch>
                Explore a vendor
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {productCategoriesMock.map((cat) => (
            <div
              key={cat.name}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className={`h-20 bg-gradient-to-br ${cat.color}`} />
              <div className="p-4 space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">{cat.name}</h3>
                <p className="text-sm text-slate-600">{cat.blurb}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/40 p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-3xl font-semibold text-slate-900">Curated picks</h2>
              <p className="text-slate-600">
                A snapshot of what vendors are listing right now—spanning auctions, made-to-order
                items, and ready-to-ship bestsellers.
              </p>
            </div>
            <Button variant="ghost" className="text-emerald-700">
              <Link href="/faq" prefetch>
                How shopping works
              </Link>
            </Button>
          </div>
          <div className="mt-6">
            <ProductsClient limit={12} />
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
