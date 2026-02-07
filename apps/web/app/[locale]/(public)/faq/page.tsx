import { getTranslations } from "@/i18n/server";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.server";

export const metadata = {
  title: "FAQ | MarketHub",
  description: "Frequently asked questions about MarketHub",
};

// PPR: Fully static page (no dynamic slots needed)
export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);
  const entries = t.raw("faq.entries") as Array<{ q: string; a: string }>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          {t("faq.eyebrow")}
        </p>
        <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">{t("faq.title")}</h1>
        <p className="mt-3 text-lg text-slate-600">
          {t("faq.lead")}{" "}
          <Link href="/about" className="text-emerald-700 underline">
            {t("faq.leadLink")}
          </Link>
          .
        </p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {entries.map((item) => (
          <div
            key={item.q}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100"
          >
            <h3 className="text-base font-semibold text-slate-900">{item.q}</h3>
            <p className="mt-2 text-sm text-slate-600">{item.a}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
