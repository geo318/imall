"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import Link from "next/link";

const sections = [
  {
    href: "settings",
    title: "Shop settings",
    desc: "Name, branding, bank details, addresses",
  },
  {
    href: "catalog",
    title: "Catalog",
    desc: "Products, markdown descriptions, variants, media",
  },
  {
    href: "inventory",
    title: "Inventory",
    desc: "Adjust stock, ledger entries, snapshots",
  },
  {
    href: "auctions",
    title: "Auctions",
    desc: "Min increment, buy-now, anti-snipe windows",
  },
  {
    href: "orders",
    title: "Orders",
    desc: "Payments, shipping status, fulfillment notes",
  },
];

export default function AdminShopPage({ params }: { params: { shopSlug: string } }) {
  const { shopSlug } = params;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <Badge variant="secondary">Admin workspace</Badge>
              <CardTitle>{shopSlug} management</CardTitle>
              <CardDescription>
                Clerk roles pending; assume admin-only for now. Hook API mutations to these sections
                next.
              </CardDescription>
            </div>
            <Link
              href={`/${shopSlug}`}
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              View shop →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map((section) => (
                <Card
                  key={section.href}
                  className="h-full border-slate-200 transition hover:border-brand-200 hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <Badge variant="outline">WIP</Badge>
                    </div>
                    <CardDescription>{section.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Link href={`/admin/${shopSlug}/${section.href}`}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Implementation notes</CardTitle>
            <CardDescription>
              Server actions or API client should enforce tenant scoping by shopSlug and guard with
              Clerk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p className="text-slate-800">
              Quick stub form to test primitives (wire to API later):
            </p>
            <div className="space-y-2">
              <div className="grid gap-1.5">
                <Label htmlFor="shop-name">Shop name</Label>
                <Input id="shop-name" placeholder="Acme Auctions" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bank-details">Bank details (notes)</Label>
                <Textarea id="bank-details" placeholder="Account / IBAN / payout notes" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="admin-notes">Admin notes</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Markdown accepted later; store in settings JSON"
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm">Save draft</Button>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
