import { auth } from "@clerk/nextjs/server";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "@/i18n/navigation.server";
import { getTranslations } from "@/i18n/server";
import { defaultLocale, type Locale } from "@/i18n/config";
import { getMyShops } from "@/app/actions/shops";
import { SellForm } from "./sell-form";

export default async function SellPage({ params }: { params: Promise<{ locale: string }> }) {
  noStore();
  const { locale } = await params;
  const t = await getTranslations(locale as Locale);
  const { userId } = await auth();

  if (!userId) {
    const redirectUrl = locale === defaultLocale ? "/sell" : `/${locale}/sell`;
    return redirect(`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`);
  }

  const shops = await getMyShops().catch(() => []);
  if (shops[0]?.slug) {
    return redirect(`/admin/${shops[0].slug}`);
  }

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            {t("sell.eyebrow")}
          </p>
          <h1 className="text-3xl font-bold text-slate-900">{t("sell.title")}</h1>
          <p className="text-slate-600">{t("sell.description")}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <SellForm />
        </div>
      </div>
    </div>
  );
}
