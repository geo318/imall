"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import type { CategoryTreeNode } from "@/lib/api/categories";

function productsHref(categoryKey: string, subcategoryKey?: string) {
  const params = new URLSearchParams();
  params.set("category", categoryKey);
  if (subcategoryKey) params.set("sub", subcategoryKey);
  return `/products?${params.toString()}`;
}

type MegaMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryTreeNode[];
};

export function MegaMenu({ isOpen, onClose, categories }: MegaMenuProps) {
  const t = useTranslations();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    categories[0]?.id ?? null,
  );

  useEffect(() => {
    if (!categories.length) {
      setActiveCategoryId(null);
      return;
    }
    setActiveCategoryId((prev) =>
      prev && categories.some((category) => category.id === prev)
        ? prev
        : (categories[0]?.id ?? null),
    );
  }, [categories]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? categories[0],
    [activeCategoryId, categories],
  );

  if (!isOpen) return null;

  return (
    <div
      className="absolute left-0 right-0 top-full z-50 border-b bg-popover shadow-xl"
      role="menu"
      aria-label={t("nav.categories")}
      onMouseLeave={onClose}
    >
      <div className="container">
        <div className="flex min-h-[340px]">
          <div className="w-64 shrink-0 border-r bg-muted/30 py-2">
            {categories.length === 0 ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">{t("nav.noCategories")}</div>
            ) : (
              categories.map((category) => (
                <button
                  key={category.id}
                  onMouseEnter={() => setActiveCategoryId(category.id)}
                  type="button"
                  className={`w-full px-4 py-2.5 text-sm transition-colors ${
                    activeCategory?.id === category.id
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-3 text-left">
                      <span className="text-base">{category.icon || "📦"}</span>
                      {category.name}
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex-1 p-6">
            {activeCategory ? (
              <>
                <div className="mb-4">
                  <Link
                    href={productsHref(activeCategory.key)}
                    onClick={onClose}
                    className="text-lg font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {activeCategory.name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("nav.browseAllIn", { category: activeCategory.name })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-1 lg:grid-cols-3">
                  {activeCategory.children.map((subcategory) => (
                    <Link
                      key={subcategory.id}
                      href={productsHref(activeCategory.key, subcategory.key)}
                      onClick={onClose}
                      className="py-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      <span className="mr-2">{subcategory.icon || "📦"}</span>
                      {subcategory.name}
                    </Link>
                  ))}
                </div>

                <div className="mt-6 border-t pt-4">
                  <Link
                    href={productsHref(activeCategory.key)}
                    onClick={onClose}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t("nav.seeAllIn", { category: activeCategory.name })}
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("nav.noCategories")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
