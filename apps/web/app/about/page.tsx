import { aboutPillarsMock } from "@/MOCKS/aboutPage.mock";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { Button } from "@repo/ui/button";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">About</p>
            <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
              MarketHub is a modern multi-vendor stack.
            </h1>
            <p className="text-lg text-slate-600">
              We’re building a commerce base that supports auctions, standard carts, and vendor
              onboarding without heavy engineering lift. Use it as a demo today; extend it into a
              full marketplace tomorrow.
            </p>
            <div className="flex gap-3">
              <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href="/demo-shop" prefetch>
                  Explore the demo shop
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Link href="/admin/demo-shop" prefetch>
                  View admin workspace
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/40 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">What we’re focusing on next</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Clerk roles for admins/staff and shopper identity mapping.</li>
              <li>• Payment provider interface (keepz.me live, credo/bog/tbc next).</li>
              <li>• Shipping integrations after manual flow stabilizes.</li>
              <li>• More UI polish via the shared @repo/ui kit.</li>
            </ul>
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {aboutPillarsMock.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100"
            >
              <h4 className="text-base font-semibold text-slate-900">{pillar.title}</h4>
              <p className="mt-2 text-sm text-slate-600">{pillar.body}</p>
            </div>
          ))}
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
