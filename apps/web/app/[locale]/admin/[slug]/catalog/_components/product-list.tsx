"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/datatable";
import { Input } from "@repo/ui/input";
import { Modal, ModalBody, ModalHeader, ModalTitle } from "@repo/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import LazyImage from "@/components/shared/lazy-image";
import { Link } from "@/i18n/navigation.client";
import type { ApiProduct } from "@/lib/api/products";
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
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "title:asc", label: "Title (A-Z)" },
  { value: "title:desc", label: "Title (Z-A)" },
  { value: "price:asc", label: "Price (Low-High)" },
  { value: "price:desc", label: "Price (High-Low)" },
  { value: "stock:asc", label: "Stock (Low-High)" },
  { value: "stock:desc", label: "Stock (High-Low)" },
];

export function ProductList({ shopSlug, onEdit, statusFilter = "active" }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortSelection, setSortSelection] = useState(sortOptions[0]?.value ?? "createdAt:desc");
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
      if (!response.ok) throw new Error("Failed to fetch products");
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
      if (!response.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products", shopSlug] });
      toast.success("Product deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete product");
    },
  });

  const getProductIdentifier = (product: ProductWithStats) => {
    const shortId = product.id.replaceAll("-", "").substring(0, 8);
    return `${product.slug}-${shortId}`;
  };

  const renderStock = (product: ProductWithStats, hasAuction: boolean) => {
    if (hasAuction) {
      return <Badge variant="outline">Auction</Badge>;
    }
    const trackedStocks = product.variants
      .map((variant) => variant.availableQty)
      .filter((qty): qty is number => typeof qty === "number");

    if (trackedStocks.length === 0) {
      return <Badge variant="outline">Set stock</Badge>;
    }

    const hasOut = trackedStocks.some((qty) => qty <= 0);
    const hasLow = trackedStocks.some((qty) => qty > 0 && qty <= 5);

    if (hasOut) {
      return <Badge variant="destructive">Out</Badge>;
    }
    if (hasLow) {
      return <Badge variant="destructive">Low</Badge>;
    }
    return <Badge className="bg-emerald-100 text-emerald-900">In stock</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <Input
            placeholder="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:max-w-xs"
          />
          {isFetching && <span className="text-xs text-slate-500">Updating results...</span>}
        </div>
        <Select value={sortSelection} onValueChange={setSortSelection}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Sort" />
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

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                  {isLoading ? "Loading products..." : "No products found."}
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
                    ? `$${Number(priceValue).toFixed(2)}`
                    : "--";
                const currency = product.currency || primaryVariant?.currency || "USD";
                const trackedStocks = product.variants
                  .map((variant) => variant.availableQty)
                  .filter((qty): qty is number => typeof qty === "number");
                const totalStock =
                  trackedStocks.length > 0
                    ? trackedStocks.reduce((sum, qty) => sum + qty, 0)
                    : undefined;

                return (
                  <TableRow key={product.id}>
                    <TableCell>
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
                            {product.category || "Uncategorized"} · {variantCount} variant
                            {variantCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{priceLabel}</div>
                      <div className="text-xs text-slate-500">
                        {hasAuction ? "Auction" : "Fixed"} · {currency}
                      </div>
                      {variantCount > 1 && !hasAuction && (
                        <button
                          type="button"
                          onClick={() => setActiveProduct(product)}
                          className="text-xs text-brand-700 hover:underline"
                        >
                          Show variants
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
                            {totalStock !== undefined ? totalStock : "--"}
                          </span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      {hasAuction ? (
                        <Badge className="bg-indigo-100 text-indigo-900">Auction</Badge>
                      ) : (
                        <Badge variant="secondary">Standard</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {product.draft ? (
                          <Badge variant="secondary">Draft</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-900">Active</Badge>
                        )}
                        {product.deletedAt && <Badge variant="destructive">Deleted</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(product.id)}
                          className="h-8 w-8 p-0"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Link href={`/${productIdentifier}`} target="_blank">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        {!product.deletedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this product?")) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            title="Delete"
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
            Showing {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, products.length)} of{" "}
            {products.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Modal open={Boolean(activeProduct)} onClose={() => setActiveProduct(null)}>
        <ModalHeader>
          <ModalTitle>Variant overview</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {activeProduct ? (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-slate-900">{activeProduct.title}</p>
                <p className="text-xs text-slate-500">
                  {activeProduct.category || "Uncategorized"}
                </p>
              </div>
              {activeProduct.hasAuction ||
              activeProduct.auctionStartingBid ||
              activeProduct.auctionCurrentPrice ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Auction product. Current price:{" "}
                  {activeProduct.auctionCurrentPrice !== null &&
                  activeProduct.auctionCurrentPrice !== undefined
                    ? `$${Number(activeProduct.auctionCurrentPrice).toFixed(2)}`
                    : "--"}{" "}
                  · Starting bid:{" "}
                  {activeProduct.auctionStartingBid !== null &&
                  activeProduct.auctionStartingBid !== undefined
                    ? `$${Number(activeProduct.auctionStartingBid).toFixed(2)}`
                    : "--"}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeProduct.variants.map((variant) => {
                        const priceValue = Number(variant.price);
                        const priceLabel = Number.isFinite(priceValue)
                          ? `$${priceValue.toFixed(2)}`
                          : "--";
                        const stockQty = variant.availableQty ?? 0;
                        return (
                          <TableRow key={variant.id}>
                            <TableCell>{variant.sku || "--"}</TableCell>
                            <TableCell>
                              {priceLabel} {variant.currency}
                            </TableCell>
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
