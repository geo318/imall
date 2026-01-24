"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, ExternalLink, Eye, Heart, Package, ShoppingCart, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import LazyImage from "@/components/shared/lazy-image";
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
  stats?: {
    viewsTotal: number;
    viewsUnique: number;
    addedToCart: number;
    loved: number;
    sold: number;
  };
};

export function ProductList({ shopSlug, onEdit, statusFilter = "active" }: Props) {
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery<ProductWithStats[]>({
    queryKey: ["admin-products", shopSlug, statusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/${shopSlug}/products?status=${statusFilter}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

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

  if (isLoading) {
    return <div className="text-center py-8 text-slate-600">Loading products...</div>;
  }

  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600">
        <p>No products found in this category.</p>
      </div>
    );
  }

  const getProductIdentifier = (product: ProductWithStats) => {
    const shortId = product.id.replaceAll("-", "").substring(0, 8);
    return `${product.slug}-${shortId}`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const primaryImageUrl = getPrimaryImage(product.images);
        const productIdentifier = getProductIdentifier(product);
        const stats = product.stats || {
          viewsTotal: 0,
          viewsUnique: 0,
          addedToCart: 0,
          loved: 0,
          sold: 0,
        };

        return (
          <Card key={product.id} className="hover:shadow-md transition-shadow overflow-hidden">
            {/* Product Image */}
            <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
              <LazyImage
                src={primaryImageUrl || ""}
                alt={product.title}
                width={400}
                height={192}
                wrapperContainerStyles="absolute inset-0"
                className="object-cover"
              />
            </div>

            <CardContent className="p-4">
              <div className="space-y-3">
                {/* Header with badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg line-clamp-2">{product.title}</h3>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {product.draft && (
                        <Badge variant="secondary" className="text-xs">
                          Draft
                        </Badge>
                      )}
                      {product.deletedAt && (
                        <Badge variant="destructive" className="text-xs">
                          Deleted
                        </Badge>
                      )}
                      {product.category && (
                        <Badge variant="outline" className="text-xs">
                          {product.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product.id)}
                      className="h-8 w-8 p-0"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
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
                </div>

                {/* Description */}
                <p className="text-sm text-slate-600 line-clamp-2">
                  {product.description || "No description"}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{stats.viewsTotal} views</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{stats.viewsUnique} unique</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    <span>{stats.addedToCart} cart</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    <span>{stats.loved} loved</span>
                  </div>
                  <div className="flex items-center gap-1 col-span-2">
                    <Package className="h-3 w-3" />
                    <span>{stats.sold} sold</span>
                  </div>
                </div>

                {/* Price and Variants */}
                <div className="flex items-center justify-between text-sm pt-2 border-t">
                  <span className="text-slate-500">
                    {product.variants.length} variant
                    {product.variants.length !== 1 ? "s" : ""}
                  </span>
                  <span className="font-semibold">
                    {product.variants[0]?.price} {product.variants[0]?.currency || "USD"}
                  </span>
                </div>

                {/* Links */}
                <div className="flex gap-2 pt-2 border-t">
                  <Link href={`/${productIdentifier}`} target="_blank" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View Product
                    </Button>
                  </Link>
                  <Link href={`/${shopSlug}`} target="_blank" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Shop
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
