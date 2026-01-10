"use client";

import { productCategoriesMock } from "@/MOCKS/productsPage.mock";
import { ProductCard } from "@/components/marketing/product-card";
import { searchProducts, type ApiProduct } from "@/lib/api/products";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { RangeSlider } from "@repo/ui/range-slider";
import { Select } from "@repo/ui/select";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function mockCategoryForSlug(slug: string) {
  const categories = productCategoriesMock.map((c) => c.name);
  let acc = 0;
  for (let i = 0; i < slug.length; i++) acc = (acc + slug.charCodeAt(i)) % 1_000_000;
  return categories[acc % categories.length] ?? categories[0] ?? "All";
}

type SortKey = "newest" | "name-asc" | "name-desc" | "price-asc" | "price-desc";
type ListingType = "all" | "buy-now" | "auction";

export function ProductsExplorerClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearch = searchParams.get("search") ?? searchParams.get("q") ?? "";
  const initialSort = (searchParams.get("sort") as SortKey | null) ?? "newest";
  const initialListingType = (searchParams.get("type") as ListingType | null) ?? "all";
  const initialMinPrice = Number(searchParams.get("minPrice") ?? "0");
  const initialMaxPrice = Number(searchParams.get("maxPrice") ?? "500");
  const initialCategories = (searchParams.get("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    Number.isFinite(initialMinPrice) ? initialMinPrice : 0,
    Number.isFinite(initialMaxPrice) ? initialMaxPrice : 500,
  ]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [listingType, setListingType] = useState<ListingType>(initialListingType);
  const [sortBy, setSortBy] = useState<SortKey>(initialSort);

  const [expandedSections, setExpandedSections] = useState({
    price: true,
    categories: true,
    listingType: true,
    sorting: true,
  });

  // Sync state when user navigates back/forward.
  useEffect(() => setSearchQuery(initialSearch), [initialSearch]);
  useEffect(() => setSortBy(initialSort), [initialSort]);
  useEffect(() => setListingType(initialListingType), [initialListingType]);
  useEffect(() => setSelectedCategories(initialCategories), [searchParams]); // categories is derived from searchParams

  function setParams(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v) sp.delete(k);
      else sp.set(k, v);
    }
    // keep legacy `q` removed
    sp.delete("q");
    const qs = sp.toString();
    router.replace(qs ? `/products?${qs}` : "/products");
  }

  // Debounced URL sync for search.
  useEffect(() => {
    const handle = setTimeout(() => {
      setParams({ search: searchQuery.trim() || undefined });
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function toggleCategory(category: string) {
    setSelectedCategories((prev) => {
      const next = prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category];
      setParams({ categories: next.length ? next.join(",") : undefined });
      return next;
    });
  }

  function clearAllFilters() {
    setSearchQuery("");
    setPriceRange([0, 500]);
    setSelectedCategories([]);
    setListingType("all");
    setSortBy("newest");
    router.replace("/products");
  }

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    priceRange[0] > 0 ||
    priceRange[1] < 500 ||
    selectedCategories.length > 0 ||
    listingType !== "all" ||
    sortBy !== "newest";

  const queryArgs = useMemo(() => {
    const min = priceRange[0];
    const max = priceRange[1];

    const apiType =
      listingType === "buy-now" ? "buyNow" : listingType === "auction" ? "auction" : "all";
    const apiSort =
      sortBy === "price-asc"
        ? "priceAsc"
        : sortBy === "price-desc"
          ? "priceDesc"
          : "newest";

    return {
      q: searchQuery.trim() || undefined,
      type: apiType as "all" | "buyNow" | "auction",
      sort: apiSort as "newest" | "priceAsc" | "priceDesc",
      minPrice: Number.isFinite(min) ? min : undefined,
      maxPrice: Number.isFinite(max) ? max : undefined,
      // client-only filters
      selectedCategories,
      sortBy,
    };
  }, [searchQuery, listingType, sortBy, priceRange, selectedCategories]);

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["products", "search", queryArgs],
      initialPageParam: 0,
      queryFn: ({ pageParam }) =>
        searchProducts({
          limit: 24,
          offset: pageParam,
          q: queryArgs.q,
          type: queryArgs.type,
          sort: queryArgs.sort,
          minPrice: queryArgs.minPrice,
          maxPrice: queryArgs.maxPrice,
        }),
      getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
      staleTime: 30_000,
    });

  const allProducts: ApiProduct[] = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const visibleProducts = useMemo(() => {
    let result = allProducts;
    if (selectedCategories.length > 0) {
      result = result.filter((p) => selectedCategories.includes(mockCategoryForSlug(p.slug)));
    }
    if (sortBy === "name-asc") result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === "name-desc") result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    return result;
  }, [allProducts, selectedCategories, sortBy]);

  const marketingProducts = useMemo(
    () => visibleProducts.map((p) => mapApiProductToMarketing(p)),
    [visibleProducts],
  );

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    if (!hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const categories = useMemo(() => productCategoriesMock.map((c) => c.name), []);

  const FilterSidebar = ({ className }: { className?: string }) => (
    <aside className={cn("space-y-6", className)}>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="w-full justify-start text-muted-foreground"
        >
          <X className="h-4 w-4 mr-2" />
          Clear all filters
        </Button>
      )}

      {/* Price Range */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => toggleSection("price")}
          className="flex items-center justify-between w-full text-sm font-semibold"
        >
          Price Range
          {expandedSections.price ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expandedSections.price && (
          <div className="space-y-4 pt-2">
            <RangeSlider
              value={priceRange}
              min={0}
              max={500}
              step={10}
              onValueChange={(next) => {
                setPriceRange(next);
                setParams({ minPrice: String(next[0]), maxPrice: String(next[1]) });
              }}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>${priceRange[0]}</span>
              <span>${priceRange[1]}</span>
            </div>
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => toggleSection("categories")}
          className="flex items-center justify-between w-full text-sm font-semibold"
        >
          Categories
          {expandedSections.categories ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expandedSections.categories && (
          <div className="space-y-2 pt-2">
            {categories.map((category) => (
              <div key={category} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category}`}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={() => toggleCategory(category)}
                />
                <Label htmlFor={`category-${category}`} className="text-sm font-normal cursor-pointer">
                  {category}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listing Type */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => toggleSection("listingType")}
          className="flex items-center justify-between w-full text-sm font-semibold"
        >
          Listing Type
          {expandedSections.listingType ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expandedSections.listingType && (
          <div className="space-y-2 pt-2">
            {([
              { id: "type-all", value: "all" as const, label: "All Listings" },
              { id: "type-buy-now", value: "buy-now" as const, label: "Buy Now" },
              { id: "type-auction", value: "auction" as const, label: "Auctions" },
            ] as const).map((t) => (
              <div key={t.id} className="flex items-center space-x-2">
                <Checkbox
                  id={t.id}
                  checked={listingType === t.value}
                  onCheckedChange={() => {
                    setListingType(t.value);
                    setParams({ type: t.value === "all" ? undefined : t.value });
                  }}
                />
                <Label htmlFor={t.id} className="text-sm font-normal cursor-pointer">
                  {t.label}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sorting */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => toggleSection("sorting")}
          className="flex items-center justify-between w-full text-sm font-semibold"
        >
          Sort By
          {expandedSections.sorting ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expandedSections.sorting && (
          <div className="pt-2">
            <Select
              value={sortBy}
              onValueChange={(value) => {
                const next = value as SortKey;
                setSortBy(next);
                setParams({ sort: next === "newest" ? undefined : next });
              }}
              options={[
                { value: "newest", label: "Newest First" },
                { value: "name-asc", label: "Name: A to Z" },
                { value: "name-desc", label: "Name: Z to A" },
                { value: "price-asc", label: "Price: Low to High" },
                { value: "price-desc", label: "Price: High to Low" },
              ]}
            />
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="container py-8">
      {/* Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          className="h-12 gap-2 md:hidden"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
        >
          <SlidersHorizontal className="h-5 w-5" />
          Filters
        </Button>
      </div>

      {/* Mobile Filters */}
      {showMobileFilters && (
        <div className="md:hidden mb-8 p-4 bg-card border border-border rounded-lg">
          <FilterSidebar />
        </div>
      )}

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <FilterSidebar className="hidden md:block w-64 shrink-0 sticky top-4 h-fit" />

        {/* Product Grid */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-6">
            Showing {marketingProducts.length} products
          </p>

          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">Loading products…</div>
          ) : isError ? (
            <div className="py-16 text-center text-red-600">
              {error instanceof Error ? error.message : "Failed to load products"}
            </div>
          ) : marketingProducts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No products found matching your criteria</p>
              <Button variant="outline" onClick={clearAllFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {marketingProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>

              <div ref={loadMoreRef} className="h-10" />

              {hasNextPage && (
                <div className="text-center mt-12">
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                  >
                    {isFetchingNextPage ? "Loading…" : "Load More Products"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

