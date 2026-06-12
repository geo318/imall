"use client";

import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/marketing/product-card";
import {
  type CategoryFilterOption,
  ProductFilterSidebar,
  type SortKey,
} from "@/components/products/product-filter-sidebar";
import { ProductSearchBar } from "@/components/products/product-search-bar";
import { ProductsWithSidebarSkeleton } from "@/components/skeletons/products-with-sidebar-skeleton";
import { useRouter, useSearchParams } from "@/i18n/navigation.client";
import { useLocale, useTranslations } from "@/i18n/provider";
import { fetchCategoryTree } from "@/lib/api/categories";
import { searchShopProducts } from "@/lib/api/products";
import { mapApiProductToMarketing } from "@/lib/marketing";
import { clampPriceRange, derivePriceBounds, type PriceBounds } from "@/lib/utils/price-range";
import { DEFAULT_CURRENCY_CODE, currencySymbol } from "@/lib/utils/currency";

type Props = {
  shopSlug: string;
};

const DEFAULT_PRICE_BOUNDS: PriceBounds = [0, 500];

export function ShopProducts({ shopSlug }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // State - sync with URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [priceBounds, setPriceBounds] = useState<PriceBounds>(DEFAULT_PRICE_BOUNDS);
  const [priceRange, setPriceRange] = useState<PriceBounds>(DEFAULT_PRICE_BOUNDS);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const { data: categoryTree = [] } = useQuery({
    queryKey: ["categories-tree", locale],
    queryFn: () => fetchCategoryTree(locale),
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const categoryOptions = useMemo<CategoryFilterOption[]>(() => {
    const toOption = (node: (typeof categoryTree)[number]): CategoryFilterOption => ({
      value: node.key,
      label: node.name,
      children: node.children.map((child) => toOption(child)),
    });

    return categoryTree.map((node) => toOption(node));
  }, [categoryTree]);

  const categoryLabelByKey = useMemo(() => {
    const mapping = new Map<string, string>();
    const visit = (node: (typeof categoryTree)[number]) => {
      mapping.set(node.key, node.name);
      node.children.forEach(visit);
    };
    categoryTree.forEach(visit);
    return mapping;
  }, [categoryTree]);

  const rootCategoryKeys = useMemo(
    () => new Set(categoryTree.map((category) => category.key)),
    [categoryTree],
  );

  const keyToRoot = useMemo(() => {
    const mapping = new Map<string, string>();

    const visit = (node: (typeof categoryTree)[number], rootKey: string) => {
      mapping.set(node.key, rootKey);
      node.children.forEach((child) => {
        visit(child, rootKey);
      });
    };

    categoryTree.forEach((root) => {
      visit(root, root.key);
    });
    return mapping;
  }, [categoryTree]);

  const descendantsByRoot = useMemo(() => {
    const mapping = new Map<string, Set<string>>();

    const collect = (node: (typeof categoryTree)[number], bucket: Set<string>) => {
      bucket.add(node.key);
      node.children.forEach((child) => {
        collect(child, bucket);
      });
    };

    categoryTree.forEach((root) => {
      const bucket = new Set<string>();
      collect(root, bucket);
      mapping.set(root.key, bucket);
    });

    return mapping;
  }, [categoryTree]);

  const effectiveCategoryKeys = useMemo(() => {
    if (selectedCategories.length === 0) {
      return null;
    }

    const selectedSet = new Set(selectedCategories);
    const selectedRoots = Array.from(selectedSet).filter((key) => rootCategoryKeys.has(key));
    const selectedChildren = Array.from(selectedSet).filter((key) => !rootCategoryKeys.has(key));
    const childrenByRoot = new Map<string, Set<string>>();

    selectedChildren.forEach((childKey) => {
      const rootKey = keyToRoot.get(childKey);
      if (!rootKey) return;
      const bucket = childrenByRoot.get(rootKey) ?? new Set<string>();
      bucket.add(childKey);
      childrenByRoot.set(rootKey, bucket);
    });

    const effectiveKeys = new Set<string>();

    selectedRoots.forEach((rootKey) => {
      const explicitChildren = childrenByRoot.get(rootKey);
      if (explicitChildren && explicitChildren.size > 0) {
        explicitChildren.forEach((key) => {
          effectiveKeys.add(key);
        });
        return;
      }

      const descendants = descendantsByRoot.get(rootKey);
      if (descendants && descendants.size > 0) {
        descendants.forEach((key) => {
          effectiveKeys.add(key);
        });
      } else {
        effectiveKeys.add(rootKey);
      }
    });

    if (selectedRoots.length === 0) {
      selectedChildren.forEach((key) => {
        effectiveKeys.add(key);
      });
    } else {
      selectedChildren.forEach((key) => {
        if (!keyToRoot.has(key)) {
          effectiveKeys.add(key);
        }
      });
    }

    return effectiveKeys;
  }, [descendantsByRoot, keyToRoot, rootCategoryKeys, selectedCategories]);

  const effectiveCategoryList = useMemo(
    () => (effectiveCategoryKeys ? Array.from(effectiveCategoryKeys).sort() : []),
    [effectiveCategoryKeys],
  );

  // Sync search query with URL params
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams]);

  // Map frontend sort keys to backend sort values
  const sortMap: Record<SortKey, "newest" | "oldest" | "priceAsc" | "priceDesc"> = {
    newest: "newest",
    oldest: "oldest",
    "price-asc": "priceAsc",
    "price-desc": "priceDesc",
  };

  // Infinite query for products
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: [
      "shop-products",
      shopSlug,
      searchQuery,
      priceRange,
      effectiveCategoryList.join(","),
      sortBy,
    ],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await searchShopProducts(shopSlug, {
        q: searchQuery || undefined,
        minPrice: priceRange[0] > priceBounds[0] ? priceRange[0] : undefined,
        maxPrice: priceRange[1] < priceBounds[1] ? priceRange[1] : undefined,
        sort: sortMap[sortBy],
        categories: effectiveCategoryList.length > 0 ? effectiveCategoryList : undefined,
        limit: 20,
        offset: pageParam,
      });
      return response;
    },
    getNextPageParam: (lastPage) => {
      return lastPage.nextOffset ?? undefined;
    },
    initialPageParam: 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
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

  const firstPageProducts = data?.pages[0]?.items ?? [];
  const derivedPriceBounds = useMemo(
    () => derivePriceBounds(firstPageProducts),
    [firstPageProducts],
  );
  const previousPriceBoundsRef = useRef<PriceBounds>(DEFAULT_PRICE_BOUNDS);

  useEffect(() => {
    if (!derivedPriceBounds) {
      return;
    }

    const previousBounds = previousPriceBoundsRef.current;
    if (
      previousBounds[0] === derivedPriceBounds[0] &&
      previousBounds[1] === derivedPriceBounds[1]
    ) {
      return;
    }

    setPriceBounds(derivedPriceBounds);
    setPriceRange((currentRange) => {
      const matchesPreviousBounds =
        currentRange[0] === previousBounds[0] && currentRange[1] === previousBounds[1];

      if (matchesPreviousBounds) {
        return derivedPriceBounds;
      }

      const clampedRange = clampPriceRange(currentRange, derivedPriceBounds);
      return clampedRange[0] === currentRange[0] && clampedRange[1] === currentRange[1]
        ? currentRange
        : clampedRange;
    });
    previousPriceBoundsRef.current = derivedPriceBounds;
  }, [derivedPriceBounds]);

  // Filter products
  const filteredProducts = useMemo(() => {
    // Filter out products with missing required data before mapping
    const validProducts = allProducts.filter((product) => product.id && product.slug);
    return validProducts.map((product) => mapApiProductToMarketing(product));
  }, [allProducts]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setPriceRange(priceBounds);
    setSelectedCategories([]);
    setSortBy("newest");
  };

  const removeSearchParam = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("search");
    router.push(params.toString() ? `/${shopSlug}?${params.toString()}` : `/${shopSlug}`, {
      scroll: false,
    });
  };

  const activeFilterItems = useMemo(() => {
    const gel = currencySymbol(DEFAULT_CURRENCY_CODE);
    const items: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (searchQuery.trim()) {
      items.push({
        key: "search",
        label: t("products.filterSearch", { query: searchQuery.trim() }),
        onRemove: removeSearchParam,
      });
    }

    if (priceRange[0] > priceBounds[0] || priceRange[1] < priceBounds[1]) {
      items.push({
        key: "price",
        label: `${t("products.filtersPrice")}: ${gel}${priceRange[0]} - ${gel}${priceRange[1]}`,
        onRemove: () => setPriceRange(priceBounds),
      });
    }

    for (const categoryKey of selectedCategories) {
      items.push({
        key: `category-${categoryKey}`,
        label: categoryLabelByKey.get(categoryKey) ?? categoryKey,
        onRemove: () =>
          setSelectedCategories((previous) => previous.filter((value) => value !== categoryKey)),
      });
    }

    return items;
  }, [categoryLabelByKey, priceBounds, priceRange, router, searchParams, searchQuery, selectedCategories, shopSlug, t]);

  if (isLoading) {
    return (
      <ProductsWithSidebarSkeleton
        count={8}
        gridClassName="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <ProductSearchBar
          placeholder={t("shopProducts.searchPlaceholder", { shopSlug })}
          basePath={`/${shopSlug}`}
        />
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
        <div className="md:hidden p-4 bg-card border rounded-lg">
          <ProductFilterSidebar
            categories={categoryOptions}
            priceRange={priceRange}
            onPriceRangeChange={setPriceRange}
            priceMin={priceBounds[0]}
            priceMax={priceBounds[1]}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            listingType="all"
            onListingTypeChange={() => {}}
            onClearFilters={clearAllFilters}
            showListingType={false}
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
          priceMin={priceBounds[0]}
          priceMax={priceBounds[1]}
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          listingType="all"
          onListingTypeChange={() => {}}
          onClearFilters={clearAllFilters}
          showListingType={false}
        />

        {/* Product Grid */}
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("products.showingCount", { count: filteredProducts.length })}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("products.sortLabel")}</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
                <SelectTrigger className="h-9 w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("products.sortNewest")}</SelectItem>
                  <SelectItem value="oldest">{t("products.sortOldest")}</SelectItem>
                  <SelectItem value="price-asc">{t("products.sortPriceAsc")}</SelectItem>
                  <SelectItem value="price-desc">{t("products.sortPriceDesc")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeFilterItems.length > 0 ? (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("products.activeFilters")}
              </span>
              {activeFilterItems.map((item) => (
                <Badge key={item.key} variant="secondary" className="gap-1 py-1">
                  {item.label}
                  <button
                    type="button"
                    onClick={item.onRemove}
                    aria-label={`Remove ${item.label}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-slate-300/50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}

          {filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">{t("products.emptyBody")}</p>
              <Button variant="outline" onClick={clearAllFilters}>
                {t("products.filtersClear")}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
