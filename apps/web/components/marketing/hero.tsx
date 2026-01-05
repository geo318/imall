import { Button } from "@repo/ui/button";
import Link from "next/link";

const stats = [
  { label: "Products", value: "10K+" },
  { label: "Vendors", value: "500+" },
  { label: "Happy Buyers", value: "50K+" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm shadow-emerald-100 animate-fade-in">
            <span aria-hidden>✨</span>
            <span>Multi-vendor marketplace</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl animate-slide-up">
            Shop from <span className="text-gradient">Thousands</span> of Trusted Vendors
          </h1>

          <p
            className="mt-4 text-lg text-slate-600 sm:text-xl animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            Discover unique products, bid on exclusive auctions, and connect directly with sellers.
            Your next favorite find is just a click away.
          </p>

          <div
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <Button
              size="lg"
              className="bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
            >
              <Link href="/demo-shop" prefetch>
                Start Shopping
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Link href="/vendors" prefetch>
                Become a Vendor
              </Link>
            </Button>
          </div>

          <div
            className="mt-12 grid grid-cols-3 gap-4 border-t border-slate-200/70 pt-8 animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            {stats.map((item) => (
              <div key={item.label}>
                <p className="text-2xl font-bold text-gradient sm:text-3xl">{item.value}</p>
                <p className="text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -left-10 top-10 h-72 w-72 rounded-full bg-emerald-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-10 h-96 w-96 rounded-full bg-emerald-100/50 blur-3xl" />
    </section>
  );
}
