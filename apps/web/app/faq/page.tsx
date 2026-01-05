import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { faqEntriesMock } from "@/MOCKS/faqPage.mock";

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">FAQ</p>
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">Questions, answered.</h1>
          <p className="mt-3 text-lg text-slate-600">
            A quick primer on how MarketHub works for buyers and vendors. Need more?{" "}
            <Link href="/about" className="text-emerald-700 underline">
              Read about the roadmap
            </Link>
            .
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {faqEntriesMock.map((item) => (
            <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h3 className="text-base font-semibold text-slate-900">{item.q}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.a}</p>
            </div>
          ))}
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
