import { Button } from "@repo/ui/button";
import { ArrowRight, Heart, Shield, Users, Zap } from "lucide-react";
import Image from "next/image";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";

export const metadata = {
  title: "About | iMall",
  description: "Learn about iMall and the mission behind our multi-vendor marketplace.",
};

// PPR: Fully static page (no dynamic slots needed)
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);
  const stats = t.raw("about.stats") as Array<{ value: string; label: string }>;
  const values = t.raw("about.values.items") as Array<{ title: string; body: string }>;
  const valueIcons = [Shield, Users, Zap, Heart];

  return (
    <div className="min-h-screen">
      <section className="bg-gradient-hero py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-4xl font-bold md:text-5xl">
              {t.rich("about.hero.title", {
                highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
              })}
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">{t("about.hero.description")}</p>
            <Link href="/products" prefetch>
              <Button variant="hero" size="lg" className="gap-2">
                {t("about.hero.ctaExplore")}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border py-16">
        <div className="container">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="mb-2 text-4xl font-bold text-gradient md:text-5xl">{stat.value}</p>
                <p className="text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-bold md:text-4xl">
                {t.rich("about.mission.title", {
                  highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
                })}
              </h2>
              <p className="mb-4 leading-relaxed text-muted-foreground">
                {t("about.mission.body1")}
              </p>
              <p className="leading-relaxed text-muted-foreground">{t("about.mission.body2")}</p>
            </div>
            <div className="relative">
              <Image
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop"
                alt={t("about.mission.imageAlt")}
                width={600}
                height={400}
                className="rounded-2xl shadow-lg"
              />
              <div className="absolute -bottom-6 -left-6 -z-10 h-32 w-32 rounded-2xl bg-primary/10" />
              <div className="absolute -right-6 -top-6 -z-10 h-24 w-24 rounded-full bg-warning/10" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-secondary/30 py-16 md:py-24">
        <div className="container">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              {t.rich("about.values.title", {
                highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
              })}
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">{t("about.values.subtitle")}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value, index) => {
              const Icon = valueIcons[index] ?? Shield;
              return (
                <div
                  key={value.title}
                  className="rounded-2xl border border-border/50 bg-card p-6 card-hover"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">{t("about.cta.title")}</h2>
            <p className="mb-8 text-muted-foreground">{t("about.cta.description")}</p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/sell" prefetch>
                <Button variant="hero" size="lg" className="gap-2">
                  {t("about.cta.primary")}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/faq" prefetch>
                <Button variant="outline" size="lg">
                  {t("about.cta.secondary")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
