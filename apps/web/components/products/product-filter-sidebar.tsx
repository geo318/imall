"use client";

import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { Label } from "@repo/ui/label";
import { RangeSlider } from "@repo/ui/range-slider";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { currencySymbol, DEFAULT_CURRENCY_CODE } from "@/lib/utils/currency";

export type SortKey = "newest" | "oldest" | "price-asc" | "price-desc";
export type ListingType = "all" | "buy-now" | "auction";
export type PriceRange = [number, number];
export type CategoryFilterOption = {
  value: string;
  label: string;
  children?: CategoryFilterOption[];
};

type Props = {
  className?: string;
  categories: CategoryFilterOption[];
  priceRange: PriceRange;
  onPriceRangeChange: (range: PriceRange) => void;
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  listingType: ListingType;
  onListingTypeChange: (type: ListingType) => void;
  onClearFilters: () => void;
  showCategories?: boolean;
  showListingType?: boolean;
  priceMin?: number;
  priceMax?: number;
};

export function resolveDraftPriceRange(current: PriceRange, incoming: PriceRange): PriceRange {
  if (current[0] === incoming[0] && current[1] === incoming[1]) {
    return current;
  }
  return incoming;
}

export function createPriceRangeHandlers(
  setDraftRange: (range: PriceRange) => void,
  onCommitRange: (range: PriceRange) => void,
) {
  return {
    onDraftChange: (range: PriceRange) => {
      setDraftRange(range);
    },
    onCommit: (range: PriceRange) => {
      onCommitRange(range);
    },
  };
}

export function ProductFilterSidebar({
  className,
  categories,
  priceRange,
  onPriceRangeChange,
  selectedCategories,
  onCategoriesChange,
  listingType,
  onListingTypeChange,
  onClearFilters,
  showCategories = true,
  showListingType = true,
  priceMin = 0,
  priceMax = 500,
}: Props) {
  const t = useTranslations();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [draftPriceRange, setDraftPriceRange] = useState<PriceRange>(priceRange);
  const [expandedSections, setExpandedSections] = useState({
    price: true,
    categories: true,
    listingType: true,
  });
  const gelSymbol = useMemo(() => currencySymbol(DEFAULT_CURRENCY_CODE), []);
  const priceRangeHandlers = useMemo(
    () => createPriceRangeHandlers(setDraftPriceRange, onPriceRangeChange),
    [onPriceRangeChange],
  );

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    setDraftPriceRange((current) => resolveDraftPriceRange(current, priceRange));
  }, [priceRange]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const collectDescendantValues = (category: CategoryFilterOption): string[] => {
    const values: string[] = [category.value];
    for (const child of category.children ?? []) {
      values.push(...collectDescendantValues(child));
    }
    return values;
  };

  const toggleRootCategory = (category: CategoryFilterOption) => {
    const selected = new Set(selectedCategories);
    const descendants = collectDescendantValues(category);

    if (selected.has(category.value)) {
      for (const value of descendants) selected.delete(value);
    } else {
      selected.add(category.value);
    }

    onCategoriesChange(Array.from(selected));
  };

  const toggleChildCategory = (rootValue: string, categoryValue: string) => {
    const selected = new Set(selectedCategories);

    selected.add(rootValue);

    if (selected.has(categoryValue)) {
      selected.delete(categoryValue);
    } else {
      selected.add(categoryValue);
    }

    onCategoriesChange(Array.from(selected));
  };

  const renderChildCategories = (
    rootValue: string,
    children: CategoryFilterOption[],
    depth = 0,
  ) => (
    <div className={cn("space-y-2", depth === 0 ? "mt-2 pl-6" : "pl-4")}>
      {children.map((child) => (
        <div key={child.value}>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`category-${rootValue}-${child.value}`}
              checked={selectedCategories.includes(child.value)}
              onCheckedChange={() => toggleChildCategory(rootValue, child.value)}
            />
            <Label
              htmlFor={`category-${rootValue}-${child.value}`}
              className="text-sm font-normal cursor-pointer text-muted-foreground"
            >
              {child.label}
            </Label>
          </div>
          {child.children?.length
            ? renderChildCategories(rootValue, child.children, depth + 1)
            : null}
        </div>
      ))}
    </div>
  );

  const hasActiveFilters =
    priceRange[0] > priceMin ||
    priceRange[1] < priceMax ||
    selectedCategories.length > 0 ||
    listingType !== "all";

  const categoriesForRender = hasHydrated ? categories : [];

  const priceSpan = Math.max(0, priceMax - priceMin);
  const minRange = Math.min(20, priceSpan);

  return (
    <aside className={cn("space-y-6", className)}>
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="w-full justify-start text-muted-foreground"
        >
          <X className="h-4 w-4 mr-2" />
          {t("products.filtersClear")}
        </Button>
      )}

      {/* Price Range */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => toggleSection("price")}
          className="flex items-center justify-between w-full text-sm font-semibold"
        >
          {t("products.filtersPrice")}
          {expandedSections.price ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.price && (
          <div className="space-y-4 pt-2" style={{ pointerEvents: "auto" }}>
            <RangeSlider
              value={draftPriceRange}
              onValueChange={(value) => priceRangeHandlers.onDraftChange(value as PriceRange)}
              onValueCommit={(value) => priceRangeHandlers.onCommit(value as PriceRange)}
              min={priceMin}
              max={priceMax}
              step={1}
              minRange={minRange}
              className="w-full"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {gelSymbol}
                {draftPriceRange[0]}
              </span>
              <span>
                {gelSymbol}
                {draftPriceRange[1]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Categories */}
      {showCategories && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection("categories")}
            className="flex items-center justify-between w-full text-sm font-semibold"
          >
            {t("products.filtersCategories")}
            {expandedSections.categories ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedSections.categories && (
            <div className="space-y-2 pt-2">
              {categoriesForRender.map((category) => (
                <div key={category.value}>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category.value}`}
                      checked={selectedCategories.includes(category.value)}
                      onCheckedChange={() => toggleRootCategory(category)}
                    />
                    <Label
                      htmlFor={`category-${category.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {category.label}
                    </Label>
                  </div>
                  {selectedCategories.includes(category.value) &&
                  (category.children?.length ?? 0) > 0
                    ? renderChildCategories(category.value, category.children ?? [])
                    : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Listing Type */}
      {showListingType && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => toggleSection("listingType")}
            className="flex items-center justify-between w-full text-sm font-semibold"
          >
            {t("products.filtersListingType")}
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
                  onCheckedChange={() => onListingTypeChange("all")}
                />
                <Label htmlFor="type-all" className="text-sm font-normal cursor-pointer">
                  {t("products.filtersAllListings")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="type-buy-now"
                  checked={listingType === "buy-now"}
                  onCheckedChange={() => onListingTypeChange("buy-now")}
                />
                <Label htmlFor="type-buy-now" className="text-sm font-normal cursor-pointer">
                  {t("products.filtersBuyNow")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="type-auction"
                  checked={listingType === "auction"}
                  onCheckedChange={() => onListingTypeChange("auction")}
                />
                <Label htmlFor="type-auction" className="text-sm font-normal cursor-pointer">
                  {t("products.filtersAuctions")}
                </Label>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
