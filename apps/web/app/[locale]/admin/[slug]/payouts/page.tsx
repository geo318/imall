import { Badge } from "@repo/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/table";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { getTranslations } from "@/i18n/server";
import { getRequestOrigin } from "@/lib/server/request-origin";
import { getServerAuthCookieHeader } from "@/lib/superadmin";
import { DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";

type PayoutEntry = {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
  scheduledFor: string;
  paidAt: string | null;
  method: string | null;
  reference: string | null;
};

type LedgerEntry = {
  id: string;
  type: string;
  amount: number | string;
  currency: string;
  occurredAt: string;
  notes: string | null;
};

async function fetchPayouts(slug: string): Promise<PayoutEntry[]> {
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}/api/admin/${slug}/payouts`, {
    cache: "no-store",
    headers: await getServerAuthCookieHeader(),
  });
  if (!response.ok) {
    throw new Error("Failed to load payouts");
  }
  return response.json();
}

async function fetchLedger(slug: string): Promise<LedgerEntry[]> {
  const origin = await getRequestOrigin();
  const response = await fetch(`${origin}/api/admin/${slug}/payouts/ledger`, {
    cache: "no-store",
    headers: await getServerAuthCookieHeader(),
  });
  if (!response.ok) {
    throw new Error("Failed to load payout ledger");
  }
  return response.json();
}

function buildMockPayouts(): PayoutEntry[] {
  const now = Date.now();
  return [
    {
      id: "PAYOUT-1001",
      status: "scheduled",
      amount: 1840.5,
      currency: DEFAULT_CURRENCY_CODE,
      scheduledFor: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      paidAt: null,
      method: "Bank transfer",
      reference: "Weekly settlement",
    },
    {
      id: "PAYOUT-1000",
      status: "paid",
      amount: 1250,
      currency: DEFAULT_CURRENCY_CODE,
      scheduledFor: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
      paidAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
      method: "Bank transfer",
      reference: "Weekly settlement",
    },
  ];
}

function buildMockLedger(): LedgerEntry[] {
  const now = Date.now();
  return [
    {
      id: "LEDGER-0009",
      type: "withdrawal",
      amount: -1250,
      currency: DEFAULT_CURRENCY_CODE,
      occurredAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "Payout transfer",
    },
    {
      id: "LEDGER-0010",
      type: "fee",
      amount: -42.75,
      currency: DEFAULT_CURRENCY_CODE,
      occurredAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "Processing fees",
    },
    {
      id: "LEDGER-0011",
      type: "chargeback",
      amount: -120,
      currency: DEFAULT_CURRENCY_CODE,
      occurredAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "Order #1042 dispute",
    },
  ];
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(amount: number | string, currency: string) {
  const value = toNumber(amount);
  return formatCurrencyAmount(value, currency || DEFAULT_CURRENCY_CODE);
}

function statusVariant(status: string) {
  if (status === "paid") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

export const metadata: Metadata = {
  title: "Payouts",
};

export default async function PayoutsPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations(locale as Locale);
  let payouts = await fetchPayouts(slug).catch(() => []);
  let ledger = await fetchLedger(slug).catch(() => []);
  let isMock = false;

  if (payouts.length === 0) {
    payouts = buildMockPayouts();
    isMock = payouts.length > 0;
  }
  if (ledger.length === 0) {
    ledger = buildMockLedger();
    isMock = true;
  }

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("adminPayouts.eyebrow")}
        </p>
        <h1 className="text-3xl font-bold">{t("adminPayouts.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("adminPayouts.description")}</p>
      </div>

      {isMock ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t("adminPayouts.mockNotice")}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("adminPayouts.scheduleTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminPayouts.table.reference")}</TableHead>
                <TableHead>{t("adminPayouts.table.status")}</TableHead>
                <TableHead>{t("adminPayouts.table.scheduled")}</TableHead>
                <TableHead>{t("adminPayouts.table.amount")}</TableHead>
                <TableHead>{t("adminPayouts.table.method")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                    {t("adminPayouts.emptySchedule")}
                  </TableCell>
                </TableRow>
              ) : (
                payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium text-slate-900">
                      {payout.reference ?? payout.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(payout.status)} className="capitalize">
                        {t(`adminPayouts.status.${payout.status}`) || payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(payout.scheduledFor).toLocaleDateString()}</TableCell>
                    <TableCell>{formatMoney(payout.amount, payout.currency)}</TableCell>
                    <TableCell className="text-slate-500">
                      {payout.method ?? t("adminPayouts.bankTransfer")}
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
          <CardTitle>{t("adminPayouts.ledgerTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminPayouts.ledger.type")}</TableHead>
                <TableHead>{t("adminPayouts.ledger.date")}</TableHead>
                <TableHead>{t("adminPayouts.ledger.amount")}</TableHead>
                <TableHead>{t("adminPayouts.ledger.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                    {t("adminPayouts.emptyLedger")}
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="capitalize">
                      {t(`adminPayouts.ledgerType.${entry.type}`) || entry.type}
                    </TableCell>
                    <TableCell>{new Date(entry.occurredAt).toLocaleDateString()}</TableCell>
                    <TableCell>{formatMoney(entry.amount, entry.currency)}</TableCell>
                    <TableCell className="text-slate-500">
                      {entry.notes ?? t("adminPayouts.notAvailable")}
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
