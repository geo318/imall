import { Button } from "@repo/ui/button";
import Link from "next/link";

const features = [
  {
    title: "Multi-tenant storefronts",
    body: "Path-based shops with per-tenant settings, branding, bank details and addresses.",
  },
  {
    title: "Catalog & variants",
    body: "Products with markdown descriptions, rich media, and variants with price/SKU/inventory.",
  },
  {
    title: "Auctions optional",
    body: "Enable auctions per variant with min increment, buy-now, and anti-snipe windows.",
  },
  {
    title: "Inventory ledger",
    body: "Ledger + snapshots to track stock, with reserve/release flows for cart and auctions.",
  },
  {
    title: "Payments & shipping",
    body: "Start with keepz.me, design for credo/bog/tbc; manual shipping now, providers later.",
  },
  {
    title: "Admin workspace",
    body: "Manage catalog, inventory, auctions, orders, and shop settings; Clerk roles planned.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12 lg:py-16">
        <header className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="space-y-4">
            <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              Tenant shop platform
            </span>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 lg:text-5xl">
              Launch shops with carts and auctions in days, not weeks.
            </h1>
            <p className="max-w-2xl text-lg text-slate-600">
              A multi-tenant commerce base: standard cart checkout, optional auctions per variant,
              inventory ledger, and admin controls for settings and payouts.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/demo-shop" prefetch>
                <Button variant="primary" size="lg" className="shadow-sm">
                  View demo shop
                </Button>
              </Link>
              <Link href="/admin/demo-shop" prefetch>
                <Button variant="outline" size="lg">
                  Open admin workspace
                </Button>
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Currently planned</p>
                <p className="text-2xl font-semibold text-slate-900">Auctions + Cart</p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                WIP
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• Payment providers: keepz.me first; credo/bog/tbc next.</li>
              <li>• Manual shipping; providers (trackings.ge/onway.ge) queued.</li>
              <li>• Clerk roles: start with admin-only, expand later.</li>
              <li>• Inventory ledger + snapshots for concurrency safety.</li>
            </ul>
          </div>
        </header>

        <section>
          <h2 className="text-xl font-semibold text-slate-900">What’s in this build</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h3 className="text-base font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 p-6 text-slate-900 shadow-inner">
          <h3 className="text-lg font-semibold">Next steps</h3>
          <p className="mt-2 text-sm text-slate-700">
            Tailwind and shadcn UI are now enabled. Wire the API to the UI, implement admin pages,
            and hook payments/shipping providers. See IMPLEMENTATION.md for the roadmap.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-brand-900">
            <span className="rounded-full bg-white px-3 py-1">Cart & Orders</span>
            <span className="rounded-full bg-white px-3 py-1">Auctions</span>
            <span className="rounded-full bg-white px-3 py-1">Inventory</span>
            <span className="rounded-full bg-white px-3 py-1">Admin</span>
            <span className="rounded-full bg-white px-3 py-1">Auth</span>
          </div>
        </section>
      </div>
    </div>
  );
}
