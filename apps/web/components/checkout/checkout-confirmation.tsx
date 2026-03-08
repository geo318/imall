"use client";

import { Button } from "@repo/ui/button";
import { Check } from "lucide-react";
import { useMemo } from "react";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";

type CheckoutConfirmationProps = {
  continueShoppingHref: string;
};

export function CheckoutConfirmation({ continueShoppingHref }: CheckoutConfirmationProps) {
  const t = useTranslations();
  const orderSuffix = useMemo(() => Math.random().toString(36).substring(2, 8).toUpperCase(), []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center py-16 px-4">
        <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="h-10 w-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2">{t("checkout.confirmed.title")}</h1>
        <p className="text-slate-600 mb-2">{t("checkout.confirmed.subtitle")}</p>
        <p className="text-sm text-slate-500 mb-8">
          {t("checkout.confirmed.orderPrefix")}
          {orderSuffix}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button>
            <Link href={continueShoppingHref}>{t("checkout.confirmed.continueShopping")}</Link>
          </Button>
          <Button variant="outline">
            <Link href="/">{t("checkout.confirmed.backHome")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
