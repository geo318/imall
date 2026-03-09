"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { ArrowLeft, MapPin, Settings, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";

type MyShop = {
  slug: string;
};

export default function AccountHomePage() {
  const t = useTranslations();
  const [primaryShopSlug, setPrimaryShopSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMyShops() {
      try {
        const response = await fetch("/api/shops/mine");
        if (!response.ok) return;
        const payload = (await response.json()) as MyShop[];
        if (cancelled) return;
        setPrimaryShopSlug(Array.isArray(payload) ? (payload[0]?.slug ?? null) : null);
      } catch {
        // Keep fallback links when my-shop request fails.
      }
    }

    loadMyShops();
    return () => {
      cancelled = true;
    };
  }, []);

  const sellerHref = primaryShopSlug ? `/admin/${primaryShopSlug}` : "/sell";
  const sellerLabel = primaryShopSlug
    ? t("accountHome.cards.sellerAdmin")
    : t("accountHome.cards.createShop");

  return (
    <div className="container py-8 md:py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center text-sm text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("accountHome.back")}
      </Link>

      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">{t("accountHome.title")}</h1>
        <p className="text-sm text-slate-600">{t("accountHome.description")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/account/orders">
          <Card className="h-full transition-colors hover:border-emerald-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                {t("accountHome.cards.orders")}
              </CardTitle>
              <CardDescription>{t("accountHome.cards.ordersDescription")}</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/account/addresses">
          <Card className="h-full transition-colors hover:border-emerald-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-emerald-600" />
                {t("accountHome.cards.addresses")}
              </CardTitle>
              <CardDescription>{t("accountHome.cards.addressesDescription")}</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href={sellerHref}>
          <Card className="h-full transition-colors hover:border-emerald-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4 text-emerald-600" />
                {sellerLabel}
              </CardTitle>
              <CardDescription>{t("accountHome.cards.sellerDescription")}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card className="mt-4">
        <CardContent className="pt-6 text-sm text-slate-600">
          {t("accountHome.footerHint")}
        </CardContent>
      </Card>
    </div>
  );
}
