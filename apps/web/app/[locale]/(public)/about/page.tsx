import { Button } from "@repo/ui/button";
import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.server";

export const metadata = {
  title: "About | MarketHub",
  description: "Learn about MarketHub - a modern multi-vendor marketplace platform",
};

// PPR: Fully static page (no dynamic slots needed)
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);
  const pillars = t.raw("about.pillars") as Array<{ title: string; body: string }>;
  const focusItems = t.raw("about.focus.items") as string[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            {t("about.eyebrow")}
          </p>
          <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
            {t("about.title")}
          </h1>
          <p className="text-lg text-slate-600">{t("about.description")}</p>
          <div className="flex gap-3">
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/demo-shop" prefetch>
                {t("about.ctaDemo")}
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              <Link href="/sell" prefetch>
                {t("about.ctaAdmin")}
              </Link>
            </Button>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-emerald-50/40 to-sky-50/40 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">{t("about.focus.title")}</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {focusItems.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {pillars.map((pillar) => (
          <div
            key={pillar.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100"
          >
            <h4 className="text-base font-semibold text-slate-900">{pillar.title}</h4>
            <p className="mt-2 text-sm text-slate-600">{pillar.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
