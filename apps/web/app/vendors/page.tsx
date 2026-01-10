"use client";

import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { Input } from "@repo/ui/input";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Search, Star, MapPin, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fetchShops } from "@/lib/api/shops";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  const { data: shops, isLoading, isError } = useQuery({
    queryKey: ["shops"],
    queryFn: () => fetchShops(50),
    staleTime: 60_000,
  });

  const filteredShops = useMemo(() => {
    if (!shops) return [];
    return shops
      .filter((shop) => {
        const lower = search.toLowerCase();
        const matchesSearch =
          shop.name.toLowerCase().includes(lower) ||
          shop.slug.toLowerCase().includes(lower);
        return matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [shops, search]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MarketingNav />
        <main className="container py-8">
          <p className="text-center text-slate-500">Loading vendors…</p>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  if (isError || !shops) {
    return (
      <div className="min-h-screen bg-slate-50">
        <MarketingNav />
        <main className="container py-8">
          <p className="text-center text-red-600">Failed to load vendors</p>
        </main>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />

      <main className="container py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Our Vendors</h1>
          <p className="text-slate-600 text-lg">
            Discover trusted sellers from around the world
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-8">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search vendors by name or specialty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-12 rounded-2xl bg-white/80 border-0"
            />
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant={showVerifiedOnly ? "primary" : "outline"}
              onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
              className="h-11 rounded-xl gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Verified Only
            </Button>
            <div className="ml-auto flex items-center gap-1 text-sm text-slate-500">
              Showing {filteredShops.length} vendor{filteredShops.length !== 1 && "s"}
            </div>
          </div>
        </div>

        {/* Vendors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredShops.map((shop) => (
            <Link
              key={shop.id}
              href={`/${shop.slug}`}
              className="group bg-white rounded-3xl border border-slate-200/50 p-6 hover:shadow-lg hover:border-emerald-300 transition-all duration-300"
            >
              {/* Vendor Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 ring-2 ring-emerald-500/10 relative overflow-hidden">
                  <Image
                    src={`https://picsum.photos/seed/${shop.slug}/120/120`}
                    alt={shop.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg truncate group-hover:text-emerald-600 transition-colors">
                      {shop.name}
                    </h3>
                    <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  </div>
                  <p className="text-sm text-slate-500 truncate">
                    {shop.slug}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium">5.0</span>
                  <span className="text-slate-500">(0)</span>
                </div>
              </div>

              {/* Badge */}
              <div className="mt-5 flex items-center justify-between text-sm">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  View Shop
                </Badge>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {filteredShops.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No vendors found</h3>
            <p className="text-slate-600 mb-6">
              Try adjusting your search or filters
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setShowVerifiedOnly(false);
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </main>

      <MarketingFooter />
    </div>
  );
}
