import { Scale } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import { getLegalSections } from "@/lib/legal";
import { LegalTabs } from "./legal-tabs";

export const metadata = {
  title: "Legal | iMall",
  description: "Privacy policy, terms, return and related legal documents.",
};

export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { locale } = await params;
  const { section } = await searchParams;
  const currentLocale = locale as Locale;
  const t = await getTranslations(currentLocale);
  const sections = await getLegalSections(currentLocale);
  const lastUpdated = "February 13, 2026";

  return (
    <div>
      <section className="bg-gradient-hero py-16 md:py-24">
        <div className="container text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Scale className="h-4 w-4" />
            {t("legal.eyebrow")}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            {t("legal.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t("legal.description")}
          </p>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
      </section>

      <div className="container py-12 md:py-16">
        <section>
          <LegalTabs
            sections={sections}
            initialSectionId={section}
            emptyLabel={t("legal.emptySections")}
          />
        </section>
      </div>
    </div>
  );
}
