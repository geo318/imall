import { ChevronDown } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";

export const metadata = {
  title: "FAQ | iMall",
  description: "Frequently asked questions about iMall marketplace",
};

// PPR: Fully static page (no dynamic slots needed)
export default async function FAQPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);
  const entries = t.raw("faq.entries") as Array<{ q: string; a: string }>;

  return (
    <div className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-slate-200/40 blur-3xl" />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-white via-emerald-50/40 to-slate-50/60 p-8 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {t("faq.eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 sm:text-5xl">
            {t("faq.title")}
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-600">
            {t("faq.lead")}{" "}
            <Link
              href="/legal"
              className="font-medium text-emerald-700 underline underline-offset-4"
            >
              {t("faq.leadLink")}
            </Link>
            .
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
              {t("nav.products")}
            </span>
            <span className="rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
              {t("footer.links.vendors")}
            </span>
            <span className="rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
              {t("footer.headings.legal")}
            </span>
          </div>
        </section>

        <section className="mt-8 space-y-3">
          {entries.map((item, index) => (
            <details
              key={item.q}
              open={index === 0}
              className="group rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-base font-semibold text-slate-900 sm:text-lg">{item.q}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-emerald-600 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{item.a}</p>
            </details>
          ))}
        </section>
      </div>
    </div>
  );
}
