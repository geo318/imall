"use client";

import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import { Label } from "@repo/ui/label";
import { RangeSlider } from "@repo/ui/range-slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type SortKey = "newest" | "oldest" | "price-asc" | "price-desc";
export type ListingType = "all" | "buy-now" | "auction";
export type CategoryFilterOption = {
  value: string;
  label: string;
};

type Props = {
  className?: string;
  categories: CategoryFilterOption[];
  priceRange: [number, number];
  onPriceRangeChange: (range: [number, number]) => void;
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  listingType: ListingType;
  onListingTypeChange: (type: ListingType) => void;
  sortBy: SortKey;
  onSortByChange: (sort: SortKey) => void;
  onClearFilters: () => void;
  showCategories?: boolean;
  showListingType?: boolean;
  priceMax?: number;
};

export function ProductFilterSidebar({
  className,
  categories,
  priceRange,
  onPriceRangeChange,
  selectedCategories,
  onCategoriesChange,
  listingType,
  onListingTypeChange,
  sortBy,
  onSortByChange,
  onClearFilters,
  showCategories = true,
  showListingType = true,
  priceMax = 500,
}: Props) {
  const t = useTranslations();
  const [expandedSections, setExpandedSections] = useState({
    price: true,
    categories: true,
    listingType: true,
    sorting: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleCategory = (categoryValue: string) => {
    onCategoriesChange(
      selectedCategories.includes(categoryValue)
        ? selectedCategories.filter((c) => c !== categoryValue)
        : [...selectedCategories, categoryValue],
    );
  };

  const hasActiveFilters =
    priceRange[0] > 0 ||
    priceRange[1] < priceMax ||
    selectedCategories.length > 0 ||
    listingType !== "all";

  // Map frontend sort keys to display labels
  const sortOptions = [
    { value: "newest", label: t("products.filtersNewest") },
    // { value: "oldest", label: "Oldest First" },
    // { value: "price-asc", label: "Price: Low to High" },
    // { value: "price-desc", label: "Price: High to Low" },
  ];

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
              value={priceRange}
              onValueChange={(value) => onPriceRangeChange(value as [number, number])}
              min={0}
              max={priceMax}
              step={10}
              minRange={20}
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
              {categories.map((category) => (
                <div key={category.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category.value}`}
                    checked={selectedCategories.includes(category.value)}
                    onCheckedChange={() => toggleCategory(category.value)}
                  />
                  <Label
                    htmlFor={`category-${category.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {category.label}
                  </Label>
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

      {/* Sorting */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => toggleSection("sorting")}
          className="flex items-center justify-between w-full text-sm font-semibold"
        >
          {t("products.filtersSortBy")}
          {expandedSections.sorting ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.sorting && (
          <div className="pt-2">
            <Select value={sortBy} onValueChange={(value) => onSortByChange(value as SortKey)}>
              <SelectTrigger className="w-full text-left">
                <SelectValue placeholder={t("products.filtersSortPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </aside>
  );
}
