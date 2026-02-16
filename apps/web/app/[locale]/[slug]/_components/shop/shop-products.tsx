"use client";

import { Button } from "@repo/ui/button";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/marketing/product-card";
import {
  type CategoryFilterOption,
  ProductFilterSidebar,
  type SortKey,
} from "@/components/products/product-filter-sidebar";
import { ProductSearchBar } from "@/components/products/product-search-bar";
import { ProductGridSkeleton } from "@/components/skeletons/product-card-skeleton";
import { useSearchParams } from "@/i18n/navigation.client";
import { useLocale, useTranslations } from "@/i18n/provider";
import { fetchCategoryTree, flattenCategoryOptions } from "@/lib/api/categories";
import { searchShopProducts } from "@/lib/api/products";
import { mapApiProductToMarketing } from "@/lib/marketing";

type Props = {
  shopSlug: string;
};

export function ShopProducts({ shopSlug }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // State - sync with URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const { data: categoryTree = [] } = useQuery({
    queryKey: ["categories-tree", locale],
    queryFn: () => fetchCategoryTree(locale),
    staleTime: 60_000,
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

  const categoryNameToKey = useMemo(() => {
    const mapping = new Map<string, string>();
    flattenCategoryOptions(categoryTree).forEach((category) => {
      mapping.set(category.key.toLowerCase(), category.key);
      mapping.set(category.label.toLowerCase(), category.key);
      mapping.set(category.fallbackName.toLowerCase(), category.key);
    });
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

  // Sync search query with URL params
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [searchParams, searchQuery]);

  // Map frontend sort keys to backend sort values
  const sortMap: Record<SortKey, "newest" | "oldest" | "priceAsc" | "priceDesc"> = {
    newest: "newest",
    oldest: "oldest",
    "price-asc": "priceAsc",
    "price-desc": "priceDesc",
  };

  // Infinite query for products
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["shop-products", shopSlug, searchQuery, priceRange, selectedCategories, sortBy],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await searchShopProducts(shopSlug, {
        q: searchQuery || undefined,
        minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
        maxPrice: priceRange[1] < 500 ? priceRange[1] : undefined,
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

  // Filter products
  const filteredProducts = useMemo(() => {
    // Filter out products with missing required data before mapping
    const validProducts = allProducts.filter((product) => product.id && product.slug);
    let result = validProducts.map((product) => mapApiProductToMarketing(product));

    // Category filter
    if (effectiveCategoryKeys && effectiveCategoryKeys.size > 0) {
      result = result.filter((product) => {
        const category = product.category?.trim().toLowerCase();
        if (!category) return false;
        const resolvedKey = categoryNameToKey.get(category);
        return resolvedKey ? effectiveCategoryKeys.has(resolvedKey) : false;
      });
    }

    return result;
  }, [allProducts, categoryNameToKey, effectiveCategoryKeys]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setPriceRange([0, 500]);
    setSelectedCategories([]);
    setSortBy("newest");
  };

  if (isLoading) {
    return <ProductGridSkeleton count={8} />;
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
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            listingType="all"
            onListingTypeChange={() => {}}
            sortBy={sortBy}
            onSortByChange={setSortBy}
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
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          listingType="all"
          onListingTypeChange={() => {}}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          onClearFilters={clearAllFilters}
          showListingType={false}
        />

        {/* Product Grid */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-6">
            {t("products.showingCount", { count: filteredProducts.length })}
          </p>

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
