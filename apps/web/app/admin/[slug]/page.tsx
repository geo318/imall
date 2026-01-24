"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import type { ApiProduct } from "@/lib/api/products";

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

export default function AdminShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery<ApiProduct[]>({
    queryKey: ["admin-products", slug],
    queryFn: async () => {
      const response = await fetch(`/api/admin/${slug}/products`);
      if (!response.ok) {
        if (response.status === 404) return [];
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Authentication required. Please sign in.");
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch products");
      }
      return response.json();
    },
    retry: false, // Don't retry on auth errors
  });

  const productCount = products?.length ?? 0;
  const totalVariants = products?.reduce((sum, p) => sum + (p.variants?.length ?? 0), 0) ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <Badge variant="secondary">Admin workspace</Badge>
              <CardTitle>{slug} management</CardTitle>
              <CardDescription>
                Clerk roles pending; assume admin-only for now. Hook API mutations to these sections
                next.
              </CardDescription>
            </div>
            <Link
              href={`/${slug}`}
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
                      {section.href === "catalog" ? (
                        <Badge variant="secondary">Active</Badge>
                      ) : (
                        <Badge variant="outline">WIP</Badge>
                      )}
                    </div>
                    <CardDescription>{section.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Link href={`/admin/${slug}/${section.href}`}>
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

        {/* Product Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-600" />
                <CardTitle>Product Overview</CardTitle>
              </div>
              <Link href={`/admin/${slug}/catalog`}>
                <Button variant="outline" size="sm">
                  Manage Catalog
                </Button>
              </Link>
            </div>
            <CardDescription>Quick stats for your product catalog</CardDescription>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="text-center py-8 text-slate-600">Loading products...</div>
            ) : productsError ? (
              <div className="text-center py-8">
                <p className="text-red-600 font-semibold mb-2">
                  {productsError instanceof Error
                    ? productsError.message
                    : "Failed to load products"}
                </p>
                <p className="text-sm text-slate-600">Please sign in to access admin features.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-2xl font-bold text-slate-900">{productCount}</div>
                  <div className="text-sm text-slate-600">Total Products</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-2xl font-bold text-slate-900">{totalVariants}</div>
                  <div className="text-sm text-slate-600">Total Variants</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {products?.filter((p) => p.hasAuction).length ?? 0}
                  </div>
                  <div className="text-sm text-slate-600">Products with Auctions</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Implementation notes</CardTitle>
            <CardDescription>
              Server actions or API client should enforce tenant scoping by slug and guard with
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
