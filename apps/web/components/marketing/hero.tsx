import { Button } from "@repo/ui/button";
import {
  ArrowRight,
  CreditCard,
  type LucideIcon,
  Package,
  Search,
  ShoppingBag,
  Star,
  Store,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import { Link } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";
import { HeroBackground } from "./hero-background";

type HeroSectionProps = {
  locale: Locale;
};

type TrustPillId = "multiVendorCart" | "secureCheckout" | "orderTracking" | "verifiedSellers";

const TRUST_PILLS: Array<{ id: TrustPillId; icon: LucideIcon }> = [
  { id: "multiVendorCart", icon: ShoppingBag },
  { id: "secureCheckout", icon: CreditCard },
  { id: "orderTracking", icon: Package },
  { id: "verifiedSellers", icon: Star },
];

export async function HeroSection({ locale }: HeroSectionProps) {
  const t = await getTranslations(locale);
  const isKa = locale === "ka";
  const compactCopy = locale === "ka" || locale === "ru";

  return (
    <section className="relative isolate -mt-16 flex min-h-[560px] items-center overflow-hidden bg-gradient-hero pt-16 sm:min-h-[620px] md:min-h-[720px] lg:min-h-[760px]">
      <HeroBackground />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-b from-transparent via-white/40 to-white/85" />

      <div className="container hero-content-layer pointer-events-none relative z-10 py-10 sm:py-12 md:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-in pointer-events-auto mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/12 px-5 py-2.5 text-sm font-semibold text-emerald-700 backdrop-blur-[2px] shadow-glow">
            <Store className="h-4 w-4 text-emerald-600" />
            <span>{t("home.hero.badge")}</span>
          </div>

          <h1
            className={`animate-slide-up mb-5 font-black leading-[1.1] tracking-tight text-foreground ${
              compactCopy
                ? "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
                : "text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
            }`}
          >
            {t.rich("home.hero.title", {
              highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
            })}
          </h1>

          <p
            className={`animate-slide-up mx-auto mb-9 max-w-2xl leading-relaxed text-muted-foreground ${
              compactCopy ? "text-sm sm:text-base md:text-lg" : "text-base sm:text-lg md:text-xl"
            }`}
            style={{ animationDelay: "0.1s" }}
          >
            {t("home.hero.description")}
          </p>

          <div
            className="animate-slide-up pointer-events-auto flex flex-col justify-center gap-4 sm:flex-row"
            style={{ animationDelay: "0.2s" }}
          >
            <Link href="/products" prefetch className="pointer-events-auto">
              <Button
                variant="hero"
                size="lg"
                className="rounded-full border border-emerald-500/40 bg-emerald-600 px-6 py-5 md:px-8 md:py-6 flex flex-row gap-2 text-base text-white shadow-glow hover:bg-emerald-700"
              >
                <Search className="h-5 w-5" />
                {t("home.hero.ctaShop")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sell" prefetch className="pointer-events-auto">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-emerald-300 flex flex-row gap-2 bg-white/85 px-6 py-5 md:px-8 md:py-6 text-base text-emerald-700 hover:bg-emerald-50"
              >
                <Store className="h-5 w-5 text-emerald-600" />
                {t("home.hero.ctaVendor")}
              </Button>
            </Link>
          </div>

          <div
            className="animate-fade-in mt-11 flex flex-wrap justify-center gap-3"
            style={{ animationDelay: "0.3s" }}
          >
            {TRUST_PILLS.map(({ id, icon: Icon }, index) => (
              <div
                key={id}
                className={`${index > 1 ? "hidden sm:inline-flex" : "inline-flex"} items-center gap-2.5 rounded-full border border-border/45 bg-background/78 px-4 md:px-5 py-2.5 font-medium text-muted-foreground shadow-md backdrop-blur-[2px] ${
                  isKa ? "text-[11px] md:text-xs" : compactCopy ? "text-xs md:text-sm" : "text-sm"
                }`}
              >
                <Icon className="h-4 w-4 text-emerald-600" />
                {t(`home.hero.pills.${id}`)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
