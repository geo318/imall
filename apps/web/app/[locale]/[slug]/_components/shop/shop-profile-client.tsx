"use client";

import { ShopBusinessCard } from "@/components/shared/shop-business-card";
import { useTranslations } from "@/i18n/provider";
import { ShopProducts } from "./shop-products";

type Props = {
  shopSlug: string;
  shopName: string;
  sellerEmail?: string | null;
  sellerPhone?: string | null;
  sellerRules?: string | null;
};

export function ShopProfileClient({
  shopSlug,
  shopName,
  sellerEmail,
  sellerPhone,
  sellerRules,
}: Props) {
  const t = useTranslations();
  const hasSellerInfo = Boolean(shopName || sellerEmail || sellerPhone || sellerRules);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">{shopName}</h1>
        <p className="mt-2 text-slate-600">{t("shopProfile.subtitle", { shopSlug })}</p>
      </div>

      {hasSellerInfo ? (
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ShopBusinessCard
            legalName={shopName}
            email={sellerEmail ?? null}
            mobile={sellerPhone ?? null}
          />
          {sellerRules ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("sellerInfo.rules")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{sellerRules}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <ShopProducts shopSlug={shopSlug} />
    </div>
  );
}
