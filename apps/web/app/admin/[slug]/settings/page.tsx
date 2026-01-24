import { Metadata } from "next";
import { ShopSettingsForm } from "./shop-settings-form";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Shop Settings",
};

async function fetchSettings(slug: string) {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/settings`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load shop settings");
  }

  return response.json();
}

export default async function ShopSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await fetchSettings(slug);

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Settings</p>
        <h1 className="text-3xl font-bold">{settings.name ?? slug} Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Update the storefront metadata and custom settings that your shop exposes.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <ShopSettingsForm
          shopSlug={slug}
          initialName={settings.name ?? slug}
          initialSettings={settings.settings ?? "{}"}
        />
      </div>
    </div>
  );
}
