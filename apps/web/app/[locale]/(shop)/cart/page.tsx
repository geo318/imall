import { Suspense } from "react";
import { CartSkeleton } from "@/components/skeletons/cart-skeleton";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import { CartContent } from "./_components/cart-content";

export const metadata = {
  title: "Shopping Cart | MarketHub",
  description: "Review your cart items and proceed to checkout",
};

// PPR: Static shell with dynamic cart content slot
export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);

  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">{t("cart.title")}</h1>
      {/* Dynamic slot: Cart content with Suspense boundary */}
      <Suspense
        fallback={
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <CartSkeleton />
            </div>
            <div className="lg:col-span-1">
              <div className="bg-white border border-slate-200 rounded-xl p-6 sticky top-24 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
                <div className="space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-full" />
                </div>
              </div>
            </div>
          </div>
        }
      >
        <CartContent />
      </Suspense>
    </div>
  );
}
