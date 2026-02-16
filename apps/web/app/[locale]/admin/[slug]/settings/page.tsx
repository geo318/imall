import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import { getSuperadminCookieHeader } from "@/lib/superadmin";
import { ShopSettingsForm } from "./shop-settings-form";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Shop Settings",
};

async function fetchSettings(slug: string) {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/settings`, {
    cache: "no-store",
    headers: await getSuperadminCookieHeader(),
  });

  if (!response.ok) {
    throw new Error("Failed to load shop settings");
  }

  return response.json();
}

export default async function ShopSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations(locale as Locale);
  const settings = await fetchSettings(slug);

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("adminSettings.eyebrow")}
        </p>
        <h1 className="text-3xl font-bold">
          {settings.name ?? slug} {t("adminSettings.configuration")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("adminSettings.description")}</p>
      </div>

      {!settings.canSell ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t("adminSettings.pendingApproval")}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-6">
        <ShopSettingsForm
          shopSlug={slug}
          initialName={settings.name ?? slug}
          initialBankDetails={settings.bankDetails ?? null}
          initialPayoutAccount={settings.payoutAccount ?? null}
          initialPayoutNotes={settings.payoutNotes ?? null}
          initialOrderNotes={settings.orderNotes ?? null}
          initialInventoryNotes={settings.inventoryNotes ?? null}
          initialSellerEmail={settings.sellerEmail ?? null}
          initialSellerPhone={settings.sellerPhone ?? null}
          initialSellerRules={settings.sellerRules ?? null}
        />
      </div>
    </div>
  );
}
