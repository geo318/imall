"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/datatable";
import { Input } from "@repo/ui/input";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "@repo/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit, ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import LazyImage from "@/components/shared/lazy-image";
import { Link } from "@/i18n/navigation.client";
import { useTranslations } from "@/i18n/provider";
import type { ApiProduct } from "@/lib/api/products";
import { currencySymbol, DEFAULT_CURRENCY_CODE, formatCurrencyAmount } from "@/lib/utils/currency";
import { getPrimaryImage } from "@/lib/utils/images";

type Props = {
  shopSlug: string;
  onEdit: (productId: string) => void;
  statusFilter?: "all" | "active" | "draft" | "deleted";
};

type ProductWithStats = ApiProduct & {
  category?: string | null;
  draft?: boolean;
  deletedAt?: string | null;
  priceMin?: number | null;
  stockTotal?: number;
  variantCount?: number;
  auctionStartingBid?: number | null;
  auctionCurrentPrice?: number | null;
  stats?: {
    viewsTotal: number;
    viewsUnique: number;
    addedToCart: number;
    loved: number;
    sold: number;
  };
};

const PAGE_SIZE = 15;

const sortOptions = [
  { value: "createdAt:desc", labelKey: "adminProductList.sort.newest" },
  { value: "createdAt:asc", labelKey: "adminProductList.sort.oldest" },
  { value: "title:asc", labelKey: "adminProductList.sort.titleAsc" },
  { value: "title:desc", labelKey: "adminProductList.sort.titleDesc" },
  { value: "price:asc", labelKey: "adminProductList.sort.priceAsc" },
  { value: "price:desc", labelKey: "adminProductList.sort.priceDesc" },
  { value: "stock:asc", labelKey: "adminProductList.sort.stockAsc" },
  { value: "stock:desc", labelKey: "adminProductList.sort.stockDesc" },
] as const;

export function ProductList({ shopSlug, onEdit, statusFilter = "active" }: Props) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortSelection, setSortSelection] = useState<string>(
    sortOptions[0]?.value ?? "createdAt:desc",
  );
  const [page, setPage] = useState(1);
  const [activeProduct, setActiveProduct] = useState<ProductWithStats | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // biome-ignore lint: needs to reset if any filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortSelection, statusFilter]);

  const { sort, order } = useMemo(() => {
    const [sortKey, sortOrder] = sortSelection.split(":");
    return {
      sort: sortKey || "createdAt",
      order: sortOrder || "desc",
    };
  }, [sortSelection]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      status: statusFilter,
      sort,
      order,
    });
    const sanitizedSearch = debouncedSearch.trim();
    if (sanitizedSearch) {
      params.set("search", sanitizedSearch);
    }
    return params.toString();
  }, [debouncedSearch, order, sort, statusFilter]);

  const { data, isLoading, isFetching } = useQuery<ProductWithStats[]>({
    queryKey: ["admin-products", shopSlug, statusFilter, debouncedSearch, sortSelection],
    queryFn: async () => {
      const response = await fetch(`/api/admin/${shopSlug}/products?${queryString}`);
      if (!response.ok) throw new Error(t("adminProductList.errors.fetchFailed"));
      return response.json();
    },
    placeholderData: keepPreviousData,
  });

  const products = data ?? [];
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const pageProducts = products.slice(startIndex, startIndex + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/admin/${shopSlug}/products/${productId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(t("adminProductList.errors.deleteFailed"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products", shopSlug] });
      toast.success(t("adminProductList.toasts.deleted"));
    },
    onError: () => {
      toast.error(t("adminProductList.toasts.deleteFailed"));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/admin/${shopSlug}/products/${productId}/duplicate`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(
          error.error || error.message || t("adminProductList.errors.duplicateFailed"),
        );
      }
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: (duplicated) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products", shopSlug] });
      toast.success(t("adminProductList.toasts.duplicated"));
      onEdit(duplicated.id);
    },
    onError: () => {
      toast.error(t("adminProductList.toasts.duplicateFailed"));
    },
  });

  const getProductIdentifier = (product: ProductWithStats) => {
    const shortId = product.id.replaceAll("-", "").substring(0, 8);
    return `${product.slug}-${shortId}`;
  };

  const renderStock = (product: ProductWithStats, hasAuction: boolean) => {
    if (hasAuction) {
      return <Badge variant="outline">{t("adminProductList.stock.auction")}</Badge>;
    }
    if (product.variants.some((variant) => variant.trackInventory === false)) {
      return (
        <Badge className="bg-sky-100 text-sky-900">{t("adminProductList.stock.infinite")}</Badge>
      );
    }
    const trackedStocks = product.variants
      .filter((variant) => variant.trackInventory !== false)
      .map((variant) => variant.availableQty)
      .filter((qty): qty is number => typeof qty === "number");

    if (trackedStocks.length === 0) {
      return <Badge variant="outline">{t("adminProductList.stock.setStock")}</Badge>;
    }

    const hasOut = trackedStocks.some((qty) => qty <= 0);
    const hasLow = trackedStocks.some((qty) => qty > 0 && qty <= 5);

    if (hasOut) {
      return <Badge variant="destructive">{t("adminProductList.stock.out")}</Badge>;
    }
    if (hasLow) {
      return <Badge variant="destructive">{t("adminProductList.stock.low")}</Badge>;
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-900">
        {t("adminProductList.stock.inStock")}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Input
            placeholder={t("adminProductList.searchPlaceholder")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:max-w-xs"
          />
          {isFetching && (
            <span className="text-xs text-slate-500">{t("adminProductList.updatingResults")}</span>
          )}
        </div>
        <Select value={sortSelection} onValueChange={setSortSelection}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder={t("adminProductList.sort.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("adminProductList.table.product")}</TableHead>
              <TableHead>{t("adminProductList.table.price")}</TableHead>
              <TableHead>{t("adminProductList.table.stock")}</TableHead>
              <TableHead>{t("adminProductList.table.type")}</TableHead>
              <TableHead>{t("adminProductList.table.status")}</TableHead>
              <TableHead className="text-right">{t("adminProductList.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                  {isLoading ? t("adminProductList.loading") : t("adminProductList.empty")}
                </TableCell>
              </TableRow>
            ) : (
              pageProducts.map((product) => {
                const primaryImageUrl = getPrimaryImage(product.images);
                const productIdentifier = getProductIdentifier(product);
                const variantCount = product.variantCount ?? product.variants.length;
                const hasAuction = Boolean(
                  product.hasAuction ||
                    product.variants.some((variant) => Boolean(variant.auction)) ||
                    product.auctionStartingBid ||
                    product.auctionCurrentPrice,
                );
                const primaryVariant = product.variants[0];
                const primaryPrice = primaryVariant?.price
                  ? Number(primaryVariant.price)
                  : Number.NaN;
                const variantPrices = product.variants
                  .map((variant) => Number(variant.price))
                  .filter((value) => Number.isFinite(value));
                const derivedPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : null;
                const basePrice = Number.isFinite(primaryPrice)
                  ? primaryPrice
                  : (product.priceMin ?? derivedPrice);
                const auctionPrice =
                  product.auctionCurrentPrice ?? product.auctionStartingBid ?? basePrice;
                const priceValue = hasAuction ? auctionPrice : basePrice;
                const priceLabel =
                  priceValue !== null && priceValue !== undefined && Number.isFinite(priceValue)
                    ? formatCurrencyAmount(
                        Number(priceValue),
                        product.currency || primaryVariant?.currency,
                      )
                    : "--";
                const currency =
                  product.currency || primaryVariant?.currency || DEFAULT_CURRENCY_CODE;
                const currencyLabel = currencySymbol(currency);
                const trackedStocks = product.variants
                  .filter((variant) => variant.trackInventory !== false)
                  .map((variant) => variant.availableQty)
                  .filter((qty): qty is number => typeof qty === "number");
                const hasInfiniteStock = product.variants.some(
                  (variant) => variant.trackInventory === false,
                );
                const totalStock = hasInfiniteStock
                  ? null
                  : trackedStocks.length > 0
                    ? trackedStocks.reduce((sum, qty) => sum + qty, 0)
                    : undefined;

                return (
                  <TableRow key={product.id}>
                    <TableCell className="max-w-64">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-md bg-slate-100">
                          <LazyImage
                            src={primaryImageUrl || ""}
                            alt={product.title}
                            width={48}
                            height={48}
                            wrapperContainerStyles="absolute inset-0"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{product.title}</p>
                          <p className="text-xs text-slate-500">
                            {product.category || t("adminProductList.uncategorized")} ·{" "}
                            {t("adminProductList.variantCount", { count: variantCount })}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{priceLabel}</div>
                      <div className="text-xs text-slate-500">
                        {hasAuction
                          ? t("adminProductList.type.auction")
                          : t("adminProductList.type.fixed")}{" "}
                        · {currencyLabel}
                      </div>
                      {variantCount > 1 && !hasAuction && (
                        <button
                          type="button"
                          onClick={() => setActiveProduct(product)}
                          className="text-xs text-brand-700 hover:underline"
                        >
                          {t("adminProductList.showVariants")}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setActiveProduct(product)}
                        className="flex items-center gap-2 text-left"
                      >
                        {renderStock(product, hasAuction)}
                        {!hasAuction && (
                          <span className="text-xs text-slate-500">
                            {hasInfiniteStock
                              ? t("adminProductList.stock.infinite")
                              : totalStock !== undefined
                                ? totalStock
                                : "--"}
                          </span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      {hasAuction ? (
                        <Badge className="bg-indigo-100 text-indigo-900">
                          {t("adminProductList.type.auction")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t("adminProductList.type.standard")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {product.draft ? (
                          <Badge variant="secondary">{t("adminProductList.status.draft")}</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-900">
                            {t("adminProductList.status.active")}
                          </Badge>
                        )}
                        {product.deletedAt && (
                          <Badge variant="destructive">
                            {t("adminProductList.status.deleted")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(product.id)}
                          className="h-8 w-8 p-0"
                          title={t("adminProductList.actions.edit")}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Link href={`/${productIdentifier}`} target="_blank">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title={t("adminProductList.actions.view")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        {!product.deletedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateMutation.mutate(product.id)}
                            disabled={duplicateMutation.isPending}
                            className="h-8 w-8 p-0"
                            title={t("adminProductList.actions.duplicate")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {!product.deletedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(t("adminProductList.deleteConfirm"))) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title={t("adminProductList.actions.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {products.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {t("adminProductList.pagination.showing", {
              from: startIndex + 1,
              to: Math.min(startIndex + PAGE_SIZE, products.length),
              total: products.length,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              {t("adminProductList.pagination.previous")}
            </Button>
            <span className="text-xs text-slate-500">
              {t("adminProductList.pagination.pageOf", { page, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              {t("adminProductList.pagination.next")}
            </Button>
          </div>
        </div>
      )}

      <Modal open={Boolean(activeProduct)} onClose={() => setActiveProduct(null)}>
        <ModalHeader>
          <ModalTitle>{t("adminProductList.variantOverview.title")}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {activeProduct ? (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-slate-900">{activeProduct.title}</p>
                <p className="text-xs text-slate-500">
                  {activeProduct.category || t("adminProductList.uncategorized")}
                </p>
              </div>
              {activeProduct.hasAuction ||
              activeProduct.auctionStartingBid ||
              activeProduct.auctionCurrentPrice ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {t("adminProductList.variantOverview.auctionProduct")}{" "}
                  {activeProduct.auctionCurrentPrice !== null &&
                  activeProduct.auctionCurrentPrice !== undefined
                    ? formatCurrencyAmount(
                        Number(activeProduct.auctionCurrentPrice),
                        activeProduct.currency,
                      )
                    : "--"}{" "}
                  · {t("adminProductList.variantOverview.startingBid")}{" "}
                  {activeProduct.auctionStartingBid !== null &&
                  activeProduct.auctionStartingBid !== undefined
                    ? formatCurrencyAmount(
                        Number(activeProduct.auctionStartingBid),
                        activeProduct.currency,
                      )
                    : "--"}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("adminProductList.table.sku")}</TableHead>
                        <TableHead>{t("adminProductList.table.price")}</TableHead>
                        <TableHead>{t("adminProductList.table.stock")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeProduct.variants.map((variant) => {
                        const priceValue = Number(variant.price);
                        const priceLabel = Number.isFinite(priceValue)
                          ? formatCurrencyAmount(priceValue, variant.currency)
                          : "--";
                        const stockQty =
                          variant.trackInventory === false
                            ? t("adminProductList.stock.infinite")
                            : (variant.availableQty ?? 0);
                        return (
                          <TableRow key={variant.id}>
                            <TableCell>
                              {variant.sku || t("adminProductList.variantOverview.noSkuShort")}
                            </TableCell>
                            <TableCell>{priceLabel}</TableCell>
                            <TableCell>{stockQty}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}
        </ModalBody>
      </Modal>
    </div>
  );
}
