"use client";

import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";

type CheckoutConfirmationProps = {
  continueShoppingHref: string;
};

export function CheckoutConfirmation({ continueShoppingHref }: CheckoutConfirmationProps) {
  const t = useTranslations();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center py-16 px-4">
        <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{t("checkout.confirmed.title")}</h1>
        <p className="text-slate-600 mb-2">{t("checkout.confirmed.subtitle")}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            href={continueShoppingHref}
          >
            {t("checkout.confirmed.continueShopping")}
          </Link>
          <Link
            className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            href="/"
          >
            {t("checkout.confirmed.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
