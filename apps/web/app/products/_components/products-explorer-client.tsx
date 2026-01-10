"use client";

import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { RangeSlider } from "@repo/ui/range-slider";
import { Select } from "@repo/ui/select";
import { uuid } from "@tanstack/react-form";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/marketing/product-card";
import { searchProducts } from "@/lib/api/products";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { cn } from "@/lib/utils";
import { productCategoriesMock } from "@/MOCKS/productsPage.mock";

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
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // State - sync with URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [listingType, setListingType] = useState<ListingType>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  // Sync search query with URL params
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams, searchQuery]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    price: true,
    categories: true,
    listingType: true,
    sorting: true,
  });

  // Infinite query for products
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["products", searchQuery, priceRange, selectedCategories, listingType, sortBy],
    queryFn: async ({ pageParam = 0 }) => {
      // Map frontend sort keys to backend sort values
      const sortMap: Record<SortKey, "newest" | "oldest" | "priceAsc" | "priceDesc" | "random"> = {
        newest: "newest",
        "name-asc": "newest", // Backend doesn't support name sorting, use newest
        "name-desc": "oldest", // Backend doesn't support name sorting, use oldest
        "price-asc": "priceAsc",
        "price-desc": "priceDesc",
      };

      const response = await searchProducts({
        q: searchQuery || undefined, // Backend expects 'q', not 'query'
        minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
        maxPrice: priceRange[1] < 500 ? priceRange[1] : undefined,
        type: listingType === "all" ? undefined : listingType === "auction" ? "auction" : "buyNow",
        sort: sortMap[sortBy],
        limit: 20,
        offset: pageParam,
      });
      return response;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.nextOffset ?? undefined;
    },
    initialPageParam: 0,
  });

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten products from all pages
  const allProducts = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  // Filter and sort products (client-side for categories since they're mocked)
  const filteredProducts = useMemo(() => {
    // Filter out products with missing required data before mapping
    const validProducts = allProducts.filter((product) => product.id && product.slug);
    let result = validProducts.map((product) => mapApiProductToMarketing(product));

    // Category filter (mock)
    if (selectedCategories.length > 0) {
      result = result.filter((product) => {
        const category = mockCategoryForSlug(product.slug);
        return selectedCategories.includes(category);
      });
    }

    return result;
  }, [allProducts, selectedCategories]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setPriceRange([0, 500]);
    setSelectedCategories([]);
    setListingType("all");
    setSortBy("newest");
    router.push("/products");
  };

  const hasActiveFilters =
    searchQuery ||
    priceRange[0] > 0 ||
    priceRange[1] < 500 ||
    selectedCategories.length > 0 ||
    listingType !== "all";

  const categories = productCategoriesMock.map((c) => c.name);

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
          {expandedSections.price ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.price && (
          <div className="space-y-4 pt-2">
            <RangeSlider
              value={priceRange}
              onValueChange={(value) => setPriceRange(value as [number, number])}
              min={0}
              max={500}
              step={10}
              className="w-full"
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
          {expandedSections.categories ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
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
                <Label
                  htmlFor={`category-${category}`}
                  className="text-sm font-normal cursor-pointer"
                >
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
          {expandedSections.listingType ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.listingType && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="type-all"
                checked={listingType === "all"}
                onCheckedChange={() => setListingType("all")}
              />
              <Label htmlFor="type-all" className="text-sm font-normal cursor-pointer">
                All Listings
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="type-buy-now"
                checked={listingType === "buy-now"}
                onCheckedChange={() => setListingType("buy-now")}
              />
              <Label htmlFor="type-buy-now" className="text-sm font-normal cursor-pointer">
                Buy Now
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="type-auction"
                checked={listingType === "auction"}
                onCheckedChange={() => setListingType("auction")}
              />
              <Label htmlFor="type-auction" className="text-sm font-normal cursor-pointer">
                Auctions
              </Label>
            </div>
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
          {expandedSections.sorting ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.sorting && (
          <div className="pt-2">
            <Select value={sortBy} onValueChange={(value: SortKey) => setSortBy(value)}>
              <Select.Trigger className="w-full">
                <Select.Value placeholder="Sort by..." />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="newest">Newest First</Select.Item>
                <Select.Item value="name-asc">Name: A to Z</Select.Item>
                <Select.Item value="name-desc">Name: Z to A</Select.Item>
                <Select.Item value="price-asc">Price: Low to High</Select.Item>
                <Select.Item value="price-desc">Price: High to Low</Select.Item>
              </Select.Content>
            </Select>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="container py-8">
      {/* Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const sp = new URLSearchParams(searchParams.toString());
            if (searchQuery.trim()) {
              sp.set("search", searchQuery.trim());
            } else {
              sp.delete("search");
            }
            router.push(sp.toString() ? `/products?${sp.toString()}` : "/products");
          }}
        >
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
              onClick={() => {
                setSearchQuery("");
                const sp = new URLSearchParams(searchParams.toString());
                sp.delete("search");
                router.push(sp.toString() ? `/products?${sp.toString()}` : "/products");
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </form>
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
        <div className="md:hidden mb-8 p-4 bg-card border rounded-lg">
          <FilterSidebar />
        </div>
      )}

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <FilterSidebar className="hidden md:block w-64 shrink-0 sticky top-4 h-fit" />

        {/* Product Grid */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-6">
            Showing {filteredProducts.length} products
          </p>

          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 12 }).map(() => (
                <div key={uuid()} className="animate-pulse">
                  <div className="aspect-square bg-slate-200 rounded-xl mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-slate-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No products found matching your criteria</p>
              <Button variant="outline" onClick={clearAllFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>

              {/* Infinite scroll trigger */}
              <div ref={loadMoreRef} className="h-10" />
              {isFetchingNextPage && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading more products...</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
