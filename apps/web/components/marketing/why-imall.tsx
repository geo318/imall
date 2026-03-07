import { Award, CreditCard, HeadphonesIcon, ShieldCheck, Store, Truck } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";

export async function WhyImall({ locale }: { locale: Locale }) {
  const t = await getTranslations(locale);
  const reasons = [
    {
      icon: Store,
      title: t("home.whyImall.items.sellers.title"),
      description: t("home.whyImall.items.sellers.description"),
    },
    {
      icon: ShieldCheck,
      title: t("home.whyImall.items.protection.title"),
      description: t("home.whyImall.items.protection.description"),
    },
    {
      icon: CreditCard,
      title: t("home.whyImall.items.checkout.title"),
      description: t("home.whyImall.items.checkout.description"),
    },
    {
      icon: Truck,
      title: t("home.whyImall.items.delivery.title"),
      description: t("home.whyImall.items.delivery.description"),
    },
    {
      icon: Award,
      title: t("home.whyImall.items.quality.title"),
      description: t("home.whyImall.items.quality.description"),
    },
    {
      icon: HeadphonesIcon,
      title: t("home.whyImall.items.support.title"),
      description: t("home.whyImall.items.support.description"),
    },
  ] as const;

  return (
    <section className="bg-secondary/30 py-16 md:py-24">
      <div className="container">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            {t.rich("home.whyImall.title", {
              highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
            })}
          </h2>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            {t("home.whyImall.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="card-hover group relative rounded-2xl border border-border/50 bg-card p-8 text-center"
            >
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                <reason.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{reason.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{reason.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
