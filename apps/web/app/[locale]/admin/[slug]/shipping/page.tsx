import { Badge } from "@repo/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import { getRequestOrigin } from "@/lib/server/request-origin";
import { getServerAuthCookieHeader } from "@/lib/superadmin";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";

type ShippingProfile = {
  id: string;
  name: string;
  carrier: string | null;
  serviceLevel: string | null;
  rateType: string;
  flatRate: number | string | null;
  currency: string | null;
  estimatedMinDays: number | string | null;
  estimatedMaxDays: number | string | null;
  active: boolean;
};

type FulfillmentRule = {
  id: string;
  priority: number | string;
  destinationCountry: string | null;
  minOrderValue: number | string | null;
  maxOrderValue: number | string | null;
  handlingDays: number | string | null;
  active: boolean;
  notes: string | null;
};

async function fetchProfiles(slug: string): Promise<ShippingProfile[]> {
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}/api/admin/${slug}/shipping-profiles`, {
    cache: "no-store",
    headers: await getServerAuthCookieHeader(),
  });
  if (!response.ok) {
    throw new Error("Failed to load shipping profiles");
  }
  return response.json();
}

async function fetchRules(slug: string): Promise<FulfillmentRule[]> {
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}/api/admin/${slug}/fulfillment-rules`, {
    cache: "no-store",
    headers: await getServerAuthCookieHeader(),
  });
  if (!response.ok) {
    throw new Error("Failed to load fulfillment rules");
  }
  return response.json();
}

function buildMockProfiles(): ShippingProfile[] {
  return [
    {
      id: "ship-standard",
      name: "Standard delivery",
      carrier: "UPS",
      serviceLevel: "Ground",
      rateType: "flat",
      flatRate: 8.5,
      currency: DEFAULT_CURRENCY_CODE,
      estimatedMinDays: 3,
      estimatedMaxDays: 6,
      active: true,
    },
    {
      id: "ship-express",
      name: "Express delivery",
      carrier: "DHL",
      serviceLevel: "Express",
      rateType: "flat",
      flatRate: 18,
      currency: DEFAULT_CURRENCY_CODE,
      estimatedMinDays: 1,
      estimatedMaxDays: 2,
      active: true,
    },
  ];
}

function buildMockRules(): FulfillmentRule[] {
  return [
    {
      id: "rule-us",
      priority: 1,
      destinationCountry: "US",
      minOrderValue: 0,
      maxOrderValue: 200,
      handlingDays: 2,
      active: true,
      notes: "Domestic ground shipping",
    },
    {
      id: "rule-intl",
      priority: 2,
      destinationCountry: "CA",
      minOrderValue: 50,
      maxOrderValue: null,
      handlingDays: 3,
      active: true,
      notes: "International orders require signature",
    },
  ];
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export const metadata: Metadata = {
  title: "Shipping",
};

export default async function ShippingPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations(locale as Locale);
  let profiles = await fetchProfiles(slug).catch(() => []);
  let rules = await fetchRules(slug).catch(() => []);
  let isMock = false;

  if (profiles.length === 0) {
    profiles = buildMockProfiles();
    isMock = profiles.length > 0;
  }
  if (rules.length === 0) {
    rules = buildMockRules();
    isMock = true;
  }

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("adminShipping.eyebrow")}
        </p>
        <h1 className="text-3xl font-bold">{t("adminShipping.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("adminShipping.description")}</p>
      </div>

      {isMock ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t("adminShipping.mockNotice")}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("adminShipping.profilesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminShipping.table.profile")}</TableHead>
                <TableHead>{t("adminShipping.table.carrier")}</TableHead>
                <TableHead>{t("adminShipping.table.rate")}</TableHead>
                <TableHead>{t("adminShipping.table.eta")}</TableHead>
                <TableHead>{t("adminShipping.table.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                    {t("adminShipping.emptyProfiles")}
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell className="text-slate-500">
                      {[profile.carrier, profile.serviceLevel].filter(Boolean).join(" / ") || "--"}
                    </TableCell>
                    <TableCell>
                      {profile.flatRate === null
                        ? t("adminShipping.variableRate")
                        : formatCurrencyAmount(
                            toNumber(profile.flatRate) ?? 0,
                            profile.currency ?? DEFAULT_CURRENCY_CODE,
                          )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const minDays = toNumber(profile.estimatedMinDays);
                        const maxDays = toNumber(profile.estimatedMaxDays);
                        if (minDays === null || maxDays === null) return t("adminShipping.notAvailable");
                        return t("adminShipping.etaDays", { min: minDays, max: maxDays });
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={profile.active ? "secondary" : "outline"}>
                        {profile.active
                          ? t("adminShipping.status.active")
                          : t("adminShipping.status.paused")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("adminShipping.rulesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminShipping.rules.priority")}</TableHead>
                <TableHead>{t("adminShipping.rules.destination")}</TableHead>
                <TableHead>{t("adminShipping.rules.orderValue")}</TableHead>
                <TableHead>{t("adminShipping.rules.handling")}</TableHead>
                <TableHead>{t("adminShipping.rules.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                    {t("adminShipping.emptyRules")}
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>{toNumber(rule.priority) ?? 0}</TableCell>
                    <TableCell>{rule.destinationCountry ?? t("adminShipping.rules.allDestinations")}</TableCell>
                    <TableCell>
                      {toNumber(rule.minOrderValue) ?? 0} -{" "}
                      {toNumber(rule.maxOrderValue) ?? t("adminShipping.rules.noMax")}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const handlingDays = toNumber(rule.handlingDays);
                        return handlingDays === null
                          ? t("adminShipping.notAvailable")
                          : t("adminShipping.handlingDays", { days: handlingDays });
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.active ? "secondary" : "outline"}>
                        {rule.active
                          ? t("adminShipping.status.active")
                          : t("adminShipping.status.paused")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
