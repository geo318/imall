"use client";

import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingNav } from "@/components/marketing-nav";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { CheckCircle, MapPin, Search, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const vendors = [
  {
    id: 1,
    name: "TechVault Pro",
    avatar: "https://picsum.photos/seed/vendor-1/120/120",
    specialty: "Electronics & Gadgets",
    category: "electronics",
    description: "Premium electronics and cutting-edge gadgets from top brands worldwide.",
    rating: 4.9,
    reviews: 1247,
    products: 156,
    sales: 5200,
    location: "San Francisco, CA",
    verified: true,
    featured: true,
  },
  {
    id: 2,
    name: "StyleHouse",
    avatar: "https://picsum.photos/seed/vendor-2/120/120",
    specialty: "Fashion & Apparel",
    category: "fashion",
    description: "Curated fashion collections featuring the latest trends and timeless classics.",
    rating: 4.8,
    reviews: 892,
    products: 324,
    sales: 3800,
    location: "New York, NY",
    verified: true,
    featured: true,
  },
  {
    id: 3,
    name: "HomeNest",
    avatar: "https://picsum.photos/seed/vendor-3/120/120",
    specialty: "Home & Living",
    category: "home",
    description: "Beautiful home decor and furniture to transform your living spaces.",
    rating: 4.7,
    reviews: 567,
    products: 89,
    sales: 1500,
    location: "Austin, TX",
    verified: true,
    featured: false,
  },
  {
    id: 4,
    name: "GreenLeaf Naturals",
    avatar: "https://picsum.photos/seed/vendor-4/120/120",
    specialty: "Health & Wellness",
    category: "health",
    description: "Organic and natural products for a healthier lifestyle.",
    rating: 4.9,
    reviews: 2103,
    products: 67,
    sales: 8900,
    location: "Portland, OR",
    verified: true,
    featured: true,
  },
  {
    id: 5,
    name: "GameZone Elite",
    avatar: "https://picsum.photos/seed/vendor-5/120/120",
    specialty: "Gaming & Entertainment",
    category: "electronics",
    description: "Everything gaming - consoles, accessories, and collectibles.",
    rating: 4.6,
    reviews: 445,
    products: 234,
    sales: 2100,
    location: "Seattle, WA",
    verified: false,
    featured: false,
  },
  {
    id: 6,
    name: "Artisan Crafts Co",
    avatar: "https://picsum.photos/seed/vendor-6/120/120",
    specialty: "Handmade & Crafts",
    category: "crafts",
    description: "Unique handcrafted items made with love and attention to detail.",
    rating: 4.8,
    reviews: 312,
    products: 178,
    sales: 890,
    location: "Nashville, TN",
    verified: true,
    featured: false,
  },
  {
    id: 7,
    name: "SportMax",
    avatar: "https://picsum.photos/seed/vendor-7/120/120",
    specialty: "Sports & Outdoors",
    category: "sports",
    description: "Quality sports equipment and outdoor gear for every adventure.",
    rating: 4.5,
    reviews: 678,
    products: 145,
    sales: 3200,
    location: "Denver, CO",
    verified: true,
    featured: false,
  },
  {
    id: 8,
    name: "BookWorm Haven",
    avatar: "https://picsum.photos/seed/vendor-8/120/120",
    specialty: "Books & Media",
    category: "books",
    description: "Rare finds and bestsellers for every book lover.",
    rating: 4.9,
    reviews: 1567,
    products: 5420,
    sales: 12000,
    location: "Boston, MA",
    verified: true,
    featured: true,
  },
];

const categories = [
  { value: "all", label: "All Categories" },
  { value: "electronics", label: "Electronics" },
  { value: "fashion", label: "Fashion" },
  { value: "home", label: "Home & Living" },
  { value: "health", label: "Health & Wellness" },
  { value: "sports", label: "Sports & Outdoors" },
  { value: "crafts", label: "Handmade & Crafts" },
  { value: "books", label: "Books & Media" },
];

const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "rating", label: "Highest Rated" },
  { value: "sales", label: "Most Sales" },
  { value: "products", label: "Most Products" },
  { value: "newest", label: "Newest" },
];

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  const filteredVendors = useMemo(() => {
    return vendors
      .filter((vendor) => {
        const lower = search.toLowerCase();
        const matchesSearch =
          vendor.name.toLowerCase().includes(lower) ||
          vendor.specialty.toLowerCase().includes(lower);
        const matchesCategory = category === "all" || vendor.category === category;
        const matchesVerified = !showVerifiedOnly || vendor.verified;
        return matchesSearch && matchesCategory && matchesVerified;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "rating":
            return b.rating - a.rating;
          case "sales":
            return b.sales - a.sales;
          case "products":
            return b.products - a.products;
          case "featured":
            return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
          case "newest":
            return b.id - a.id;
          default:
            return 0;
        }
      });
  }, [category, search, showVerifiedOnly, sortBy]);

  return (
    <div className="min-h-screen bg-slate-50">
      <MarketingNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Marketplace
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
            Discover trusted vendors running boutique shops
          </h1>
          <p className="text-base text-slate-600">
            Browse verified sellers, filter by category, and jump into a storefront immediately.
          </p>
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vendors by name or specialty..."
              className="pl-12"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1 h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-emerald-500"
              >
                {categories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-xs uppercase tracking-wide text-slate-500">
              Sort
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="mt-1 h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-emerald-500"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <Button
              size="md"
              variant={showVerifiedOnly ? "secondary" : "outline"}
              onClick={() => setShowVerifiedOnly((prev) => !prev)}
              className="gap-2 rounded-xl px-4"
            >
              <CheckCircle className="h-4 w-4" />
              Verified only
            </Button>
            <div className="ml-auto flex items-center gap-1 text-sm text-slate-500">
              Showing {filteredVendors.length} vendor
              {filteredVendors.length !== 1 && "s"}
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredVendors.map((vendor) => (
            <Link
              href={`/demo-shop/vendor/${vendor.id}`}
              key={vendor.id}
              className="group flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
            >
              <div>
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-slate-100">
                    <img
                      src={vendor.avatar}
                      alt={vendor.name}
                      className="h-full w-full rounded-2xl object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 truncate group-hover:text-emerald-600">
                        {vendor.name}
                      </h3>
                      {vendor.verified && <CheckCircle className="h-5 w-5 text-emerald-600" />}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{vendor.specialty}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500 line-clamp-2">{vendor.description}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    {vendor.products} products
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    {vendor.category}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1 text-slate-500">
                  <Star className="h-4 w-4 text-yellow-400" />
                  <span className="font-semibold text-slate-900">{vendor.rating}</span>
                  <span className="text-slate-500">({vendor.reviews})</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <MapPin className="h-4 w-4" />
                  <span>{vendor.location}</span>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                  {vendor.sales.toLocaleString()} sales
                </Badge>
                {vendor.featured && (
                  <Badge className="rounded-full bg-gradient-to-r from-emerald-400 to-sky-500 text-white">
                    Featured Seller
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </section>

        {filteredVendors.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-10 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-100">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-semibold text-slate-900">No vendors found</p>
            <p className="mt-2 text-sm text-slate-500">Try relaxing the filters or search again.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearch("");
                setCategory("all");
                setShowVerifiedOnly(false);
                setSortBy("featured");
              }}
            >
              Reset Filters
            </Button>
          </div>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
