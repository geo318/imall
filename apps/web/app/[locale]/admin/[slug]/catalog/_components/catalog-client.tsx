"use client";

import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { Plus } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation.client";
import { ProductForm } from "./product-form";
import { ProductList } from "./product-list";
import { useSearchParams } from "next/navigation";

type Props = {
  slug: string;
};

export function CatalogClient({ slug }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get edit mode from query params
  const editParam = searchParams.get("edit");
  const showForm = editParam != null;
  const editingProductId = editParam === "new" ? null : editParam;

  // Get status filter from query params (default to "active")
  const statusParam = searchParams.get("status") || "active";
  const currentStatus = (
    ["active", "draft", "deleted"].includes(statusParam) ? statusParam : "active"
  ) as "active" | "draft" | "deleted";

  // Update URL query params
  const updateQuery = (updates: { edit?: string | null; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    if ("edit" in updates) {
      if (updates.edit == null) {
        params.delete("edit");
      } else {
        params.set("edit", updates.edit === "new" ? "new" : updates.edit);
      }
    }

    if ("status" in updates) {
      if (updates.status === "active") {
        params.delete("status");
      } else {
        params.set("status", updates.status ?? "draft");
      }
    }

    router.push(`/admin/${slug}/catalog${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const handleStatusChange = (status: string) => {
    updateQuery({ status });
  };

  const handleCancel = () => {
    updateQuery({ edit: null });
  };

  const handleSuccess = () => {
    updateQuery({ edit: null });
  };

  const handleAddProduct = () => {
    updateQuery({ edit: "new" });
  };

  const handleEdit = (productId: string) => {
    updateQuery({ edit: productId });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Product Catalog</CardTitle>
              <CardDescription>Manage your products, variants, and images</CardDescription>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/${slug}`}>
                <Button variant="outline" size="sm">
                  Back
                </Button>
              </Link>
              {!showForm && (
                <Button size="sm" onClick={handleAddProduct}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              )}
              {showForm && (
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showForm ? (
              <ProductForm
                key={editingProductId || "new"}
                shopSlug={slug}
                productId={editingProductId}
                onCancel={handleCancel}
                onSuccess={handleSuccess}
              />
            ) : (
              <Tabs value={currentStatus} onValueChange={handleStatusChange} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                  <TabsTrigger value="deleted">Deleted</TabsTrigger>
                </TabsList>
                <TabsContent value="active" className="mt-4">
                  <ProductList shopSlug={slug} onEdit={handleEdit} statusFilter="active" />
                </TabsContent>
                <TabsContent value="draft" className="mt-4">
                  <ProductList shopSlug={slug} onEdit={handleEdit} statusFilter="draft" />
                </TabsContent>
                <TabsContent value="deleted" className="mt-4">
                  <ProductList shopSlug={slug} onEdit={handleEdit} statusFilter="deleted" />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
