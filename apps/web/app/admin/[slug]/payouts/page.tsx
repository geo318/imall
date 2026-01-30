import { Metadata } from "next";
import { Badge } from "@repo/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/table";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

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
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/payouts`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load payouts");
  }
  return response.json();
}

async function fetchLedger(slug: string): Promise<LedgerEntry[]> {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/payouts/ledger`, {
    cache: "no-store",
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
      currency: "USD",
      scheduledFor: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      paidAt: null,
      method: "Bank transfer",
      reference: "Weekly settlement",
    },
    {
      id: "PAYOUT-1000",
      status: "paid",
      amount: 1250,
      currency: "USD",
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
      currency: "USD",
      occurredAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "Payout transfer",
    },
    {
      id: "LEDGER-0010",
      type: "fee",
      amount: -42.75,
      currency: "USD",
      occurredAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      notes: "Processing fees",
    },
    {
      id: "LEDGER-0011",
      type: "chargeback",
      amount: -120,
      currency: "USD",
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
  return `${currency} ${value.toFixed(2)}`;
}

function statusVariant(status: string) {
  if (status === "paid") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
}

export const metadata: Metadata = {
  title: "Payouts",
};

export default async function PayoutsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
          Payouts
        </p>
        <h1 className="text-3xl font-bold">Payouts & settlements</h1>
        <p className="text-sm text-muted-foreground">
          Track upcoming settlements, fees, and chargebacks.
        </p>
      </div>

      {isMock ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Showing mock payouts and ledger entries. Wire to live finance data when available.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Settlement schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-slate-500">
                    No payouts scheduled yet.
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
                        {payout.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(payout.scheduledFor).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{formatMoney(payout.amount, payout.currency)}</TableCell>
                    <TableCell className="text-slate-500">
                      {payout.method ?? "Bank transfer"}
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
          <CardTitle>Payout ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-slate-500">
                    No ledger activity yet.
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="capitalize">{entry.type}</TableCell>
                    <TableCell>{new Date(entry.occurredAt).toLocaleDateString()}</TableCell>
                    <TableCell>{formatMoney(entry.amount, entry.currency)}</TableCell>
                    <TableCell className="text-slate-500">
                      {entry.notes ?? "--"}
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
