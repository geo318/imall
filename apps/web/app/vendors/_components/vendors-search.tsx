"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { CheckCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Shop } from "@/lib/server/shops";
import { ShopCard } from "./shop-card";

type Props = {
  shops: Shop[];
};

export function VendorsSearch({ shops: initialShops }: Readonly<Props>) {
  const [search, setSearch] = useState("");
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  const filteredShops = useMemo(() => {
    return initialShops
      .filter((shop) => {
        const lower = search.toLowerCase();
        const matchesSearch =
          shop.name.toLowerCase().includes(lower) || shop.slug.toLowerCase().includes(lower);
        return matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [initialShops, search]);

  return (
    <>
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
            variant={showVerifiedOnly ? undefined : "outline"}
            onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
            className="h-11 rounded-xl gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Verified Only
          </Button>
          <div className="ml-auto flex items-center gap-1 text-sm text-slate-500">
            Showing {filteredShops.length} vendor
            {filteredShops.length !== 1 && "s"}
          </div>
        </div>
      </div>

      {/* Vendors Grid */}
      {filteredShops.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Search className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No vendors found</h3>
          <p className="text-slate-600 mb-6">Try adjusting your search or filters</p>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredShops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </>
  );
}
