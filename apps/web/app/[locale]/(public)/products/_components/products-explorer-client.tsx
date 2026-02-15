"use client";

import { Button } from "@repo/ui/button";
import { uuid } from "@tanstack/react-form";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/marketing/product-card";
import {
  type CategoryFilterOption,
  type ListingType,
  ProductFilterSidebar,
  type SortKey,
} from "@/components/products/product-filter-sidebar";
import { ProductSearchBar } from "@/components/products/product-search-bar";
import { useSearchParams } from "@/i18n/navigation.client";
import { useLocale, useTranslations } from "@/i18n/provider";
import { fetchCategoryTree, flattenCategoryOptions } from "@/lib/api/categories";
import { searchProducts } from "@/lib/api/products";
import { mapApiProductToMarketing } from "@/lib/marketing";

export function ProductsExplorerClient() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const categoryParam = searchParams.get("category") || "";

  // State - sync with URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    categoryParam ? [categoryParam] : [],
  );
  const [listingType, setListingType] = useState<ListingType>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const { data: categoryTree = [] } = useQuery({
    queryKey: ["categories-tree", locale],
    queryFn: () => fetchCategoryTree(locale),
    staleTime: 60_000,
    retry: false,
  });

  const categoryOptions = useMemo<CategoryFilterOption[]>(
    () =>
      flattenCategoryOptions(categoryTree).map((category) => ({
        value: category.key,
        label: category.label,
      })),
    [categoryTree],
  );

  const categoryNameToKey = useMemo(() => {
    const mapping = new Map<string, string>();
    flattenCategoryOptions(categoryTree).forEach((category) => {
      mapping.set(category.key.toLowerCase(), category.key);
      mapping.set(category.label.toLowerCase(), category.key);
      mapping.set(category.fallbackName.toLowerCase(), category.key);
    });
    return mapping;
  }, [categoryTree]);

  // Sync search query with URL params
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams, searchQuery]);

  useEffect(() => {
    setSelectedCategories((prev) => {
      if (categoryParam) {
        const normalized = categoryNameToKey.get(categoryParam.toLowerCase()) ?? categoryParam;
        if (prev.length === 1 && prev[0] === normalized) return prev;
        return [normalized];
      }
      return prev.length === 0 ? prev : [];
    });
  }, [categoryNameToKey, categoryParam]);

  // Map frontend sort keys to backend sort values
  const sortMap: Record<SortKey, "newest" | "oldest" | "priceAsc" | "priceDesc" | "random"> = {
    newest: "newest",
    oldest: "oldest",
    "price-asc": "priceAsc",
    "price-desc": "priceDesc",
  };

  // Infinite query for products
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["products", searchQuery, priceRange, selectedCategories, listingType, sortBy],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const response = await searchProducts({
          q: searchQuery || undefined, // Backend expects 'q', not 'query'
          minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
          maxPrice: priceRange[1] < 500 ? priceRange[1] : undefined,
          type:
            listingType === "all" ? undefined : listingType === "auction" ? "auction" : "buyNow",
          sort: sortMap[sortBy],
          limit: 20,
          offset: pageParam,
        });
        return response;
      } catch (error) {
        console.error("Products search failed", {
          error,
          pageParam,
          searchQuery,
          priceRange,
          selectedCategories,
          listingType,
          sortBy,
        });
        throw error;
      }
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

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    // Filter out products with missing required data before mapping
    const validProducts = allProducts.filter((product) => product.id && product.slug);
    let result = validProducts.map((product) => mapApiProductToMarketing(product));

    // Category filter
    if (selectedCategories.length > 0) {
      result = result.filter((product) => {
        const category = product.category?.trim().toLowerCase();
        if (!category) return false;
        const resolvedKey = categoryNameToKey.get(category);
        return resolvedKey ? selectedCategories.includes(resolvedKey) : false;
      });
    }

    return result;
  }, [allProducts, categoryNameToKey, selectedCategories]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setPriceRange([0, 500]);
    setSelectedCategories([]);
    setListingType("all");
    setSortBy("newest");
  };

  return (
    <div className="container py-8">
      {/* Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <ProductSearchBar placeholder={t("products.searchPlaceholder")} basePath="/products" />
        <Button
          variant="outline"
          className="h-12 gap-2 md:hidden"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
        >
          <SlidersHorizontal className="h-5 w-5" />
          {t("products.filters")}
        </Button>
      </div>

      {/* Mobile Filters */}
      {showMobileFilters && (
        <div className="md:hidden mb-8 p-4 bg-card border rounded-lg">
          <ProductFilterSidebar
            categories={categoryOptions}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            listingType={listingType}
            onListingTypeChange={setListingType}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            onClearFilters={clearAllFilters}
          />
        </div>
      )}

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <ProductFilterSidebar
          className="hidden md:block w-64 shrink-0 sticky top-4 h-fit"
          categories={categoryOptions}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          listingType={listingType}
          onListingTypeChange={setListingType}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onClearFilters={clearAllFilters}
        />

        {/* Product Grid */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-6">
            {t("products.showingCount", { count: filteredProducts.length })}
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
              <p className="text-muted-foreground mb-4">{t("products.emptyBody")}</p>
              <Button variant="outline" onClick={clearAllFilters}>
                {t("products.filtersClear")}
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
                  <p className="text-muted-foreground">{t("products.loadingMore")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
