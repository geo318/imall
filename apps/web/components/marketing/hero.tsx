"use client";

import { Button } from "@repo/ui/button";
import { ArrowRight, ShieldCheck, Sparkles, Star, Truck } from "lucide-react";
import { type ComponentType, useRef } from "react";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import { HERO_FEATURES, type HeroFeatureId } from "./hero-content";
import { useMurmuration } from "./use-murmuration";

const FEATURE_ICON: Record<HeroFeatureId, ComponentType<{ className?: string }>> = {
  verified: ShieldCheck,
  shipping: Truck,
  protection: Star,
};

export function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useMurmuration(canvasRef);
  const t = useTranslations();

  return (
    <section className="relative flex min-h-[600px] items-center overflow-hidden bg-gradient-hero">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: "auto" }}
      />

      <div className="container relative z-10 py-16 md:py-24 lg:py-32 pointer-events-none">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary backdrop-blur-sm border border-primary/20 pointer-events-auto animate-fade-in">
            <Sparkles className="h-4 w-4" />
            <span>{t("home.hero.badge")}</span>
          </div>

          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl lg:text-6xl animate-slide-up">
            {t.rich("home.hero.title", {
              highlight: (chunks) => <span className="text-gradient">{chunks}</span>,
            })}
          </h1>

          <p
            className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            {t("home.hero.description")}
          </p>

          <div
            className="flex flex-col justify-center gap-4 sm:flex-row pointer-events-auto animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <Link href="/products" prefetch className="pointer-events-auto">
              <Button variant="hero" size="lg">
                {t("home.hero.ctaShop")}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/vendors" prefetch className="pointer-events-auto">
              <Button variant="outline" size="lg">
                {t("home.hero.ctaVendor")}
              </Button>
            </Link>
          </div>

          <div
            className="mt-14 grid grid-cols-1 gap-6 border-t border-border/50 pt-8 sm:grid-cols-3 animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            {HERO_FEATURES.map((item) => {
              const Icon = FEATURE_ICON[item.id];
              return (
                <div key={item.id} className="flex flex-col items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{t(item.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(item.bodyKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
