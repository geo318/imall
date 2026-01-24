"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { slugify } from "@repo/shared";
import { Button } from "@repo/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/card";
import { Checkbox } from "@repo/ui/checkbox";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { getImage } from "@/lib/utils/images";
import { ImageGalleryUpload } from "./image-gallery-upload";
import { MarkdownEditor } from "./markdown-editor";
import {
  type ImageItem,
  MOCK_CATEGORIES,
  type ProductFormData,
  productFormSchema,
  type VariantFormData,
} from "./product-form.schema";
import { VariantForm } from "./variant-form";

type Props = {
  shopSlug: string;
  productId?: string | null;
  onCancel: () => void;
  onSuccess: () => void;
};

type ProductFormResponse = ProductFormData & {
  imageUrls?: string | null;
  images?: Array<{ url?: string | null }>;
  isAuction?: boolean;
  hasAuction?: boolean;
};

export function ProductForm({ shopSlug, productId, onCancel, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      title: "",
      description: "",
      slug: "",
      category: "",
      draft: false,
      isAuction: false,
      variants: [{ price: "", currency: "USD" }],
    },
    mode: "onChange",
  });

  const isAuction = watch("isAuction");
  const watchedTitle = watch("title");
  const [isSlugDirty, setIsSlugDirty] = useState(false);

  // Load product data if editing
  const { data: productData, isLoading } = useQuery<ProductFormResponse | undefined>({
    queryKey: ["admin-product", shopSlug, productId],
    queryFn: async () => {
      if (!productId) {
        return;
      }
      const response = await fetch(`/api/admin/${shopSlug}/products/${productId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch product");
      }
      return response.json();
    },
    enabled: !!productId,
  });

  const categoryOptions = useMemo(() => {
    const options = [...MOCK_CATEGORIES] as string[];
    const currentCategory = productData?.category;
    if (currentCategory && !options.includes(currentCategory as (typeof MOCK_CATEGORIES)[number])) {
      options.push(currentCategory);
    }
    return options;
  }, [productData?.category]);

  useEffect(() => {
    if (!productId && !isSlugDirty) {
      setValue("slug", slugify(watchedTitle ?? ""));
    }
  }, [productId, isSlugDirty, setValue, watchedTitle]);

  useEffect(() => {
    if (!productId) {
      setIsSlugDirty(false);
    }
  }, [productId]);

  // Reset form when productId changes (switching between new/edit or canceling)
  useEffect(() => {
    let isActive = true;
    const blobUrls: string[] = [];

    const resetFormState = async () => {
      const hasProduct = Boolean(productId && productData);
      const normalizedCategory = productData?.category?.trim() || "";
      const normalizedVariants = (
        productData?.variants as Array<ProductFormData["variants"][number]> | undefined
      )?.map((variant) => ({
        ...variant,
        currency: variant.currency || "USD",
      }));
      const isAuctionValue = productData?.isAuction ?? productData?.hasAuction ?? false;
      const initialSlug = slugify(productData?.slug ?? productData?.title ?? "");

      const formValues = {
        title: productData?.title || "",
        description: productData?.description || "",
        slug: initialSlug || "",
        category: normalizedCategory || "",
        draft: false,
        isAuction: isAuctionValue,
        variants: normalizedVariants ?? [{ price: "", currency: "USD" }],
      };

      reset(formValues);
      setIsSlugDirty(hasProduct);

      const urlsFromImages = Array.isArray(productData?.images)
        ? productData.images.map((img: { url?: string | null }) => img.url).filter(Boolean)
        : [];
      const urlsFromImageUrls = productData?.imageUrls
        ? productData.imageUrls
            .split(",")
            .map((url: string) => url.trim())
            .filter((url: string) => url.length > 0)
        : [];
      const imageUrls = urlsFromImageUrls.length > 0 ? urlsFromImageUrls : urlsFromImages;

      if (!hasProduct || imageUrls.length === 0) {
        setImages([]);
        return;
      }

      try {
        const resolvedImages = await Promise.all(
          imageUrls.map(async (url, index) => {
            const resolvedUrl = getImage(url);
            const response = await fetch(resolvedUrl);
            if (!response.ok) {
              return {
                id: `image-${index}`,
                url: resolvedUrl,
                isPrimary: index === 0,
                assetId: `${url}-${index}`,
              };
            }
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            blobUrls.push(blobUrl);

            return {
              id: `image-${index}`,
              url: blobUrl,
              isPrimary: index === 0,
              assetId: `${url}-${index}`,
            };
          }),
        );

        if (isActive) {
          setImages(resolvedImages);
        }
      } catch {
        if (isActive) {
          setImages(
            imageUrls.map((url, index) => ({
              id: `image-${index}`,
              url: getImage(url),
              isPrimary: index === 0,
              assetId: `${url}-${index}`,
            })),
          );
        }
      }
    };

    resetFormState();

    return () => {
      isActive = false;
      blobUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [productData, productId, reset]);

  const isNewProduct = !productId;

  const saveMutation = useMutation({
    mutationFn: async (
      data: Partial<ProductFormData> & {
        images: Array<{ id: string; url?: string; isPrimary: boolean }>;
      },
    ) => {
      // Data is already validated by Zod, just ensure it's serializable
      const payload = {
        title: data.title,
        description: data.description || undefined,
        category: data.category,
        slug: data.slug || undefined,
        draft: data.draft ?? undefined,
        isAuction: data.isAuction ?? false,
        variants: data.variants,
        images: data.images,
      };

      // Remove draft when updating
      if (!isNewProduct) {
        delete (payload as Partial<typeof payload>).draft;
      }

      const url = productId
        ? `/api/admin/${shopSlug}/products/${productId}`
        : `/api/admin/${shopSlug}/products`;
      const method = productId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save product");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products", shopSlug] });
      toast.success(productId ? "Product updated successfully" : "Product created successfully");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save product");
    },
  });

  const onSubmit = async (data: Partial<ProductFormData>, isDraft = false) => {
    setIsSubmitting(true);
    try {
      const imageData = await Promise.all(
        images.map(async (img) => {
          if (img.file) {
            try {
              const formData = new FormData();
              formData.append("file", img.file);
              if (productId) {
                formData.append("productId", productId);
              }

              const response = await fetch(`/api/admin/${shopSlug}/upload/image`, {
                method: "POST",
                body: formData,
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Upload failed" }));
                throw new Error(errorData.error || `Failed to upload image: ${img.file.name}`);
              }

              const result = await response.json();
              return {
                id: result.id,
                url: result.url,
                isPrimary: img.isPrimary,
              };
            } catch (error) {
              toast.error(`Failed to upload ${img.file.name}`);
              throw error;
            }
          } else {
            return {
              id: img.assetId || img.id,
              url: img.assetId || img.url,
              isPrimary: img.isPrimary,
            };
          }
        }),
      );

      // Data is already validated by Zod, just add images and draft flag
      await saveMutation.mutateAsync({
        ...data,
        draft: isDraft,
        images: imageData,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAsDraft = async () => {
    const formData = getValues();
    await onSubmit(formData as ProductFormData, true);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-slate-600">Loading product...</div>;
  }

  const onFormSubmit = handleSubmit(
    (data) => {
      const validated = productFormSchema.parse(data);
      onSubmit(validated, false);
    },
    (errors) => {
      if (process.env.NODE_ENV === "development") {
        console.error("Form validation errors:", errors);
      }
      const errorMessages = Object.entries(errors)
        .map(([key, error]) => {
          if (error?.message) return `${key}: ${error.message}`;
          if (Array.isArray(error)) {
            return `${key}: ${error.map((e) => e?.message || "invalid").join(", ")}`;
          }
          return `${key}: validation failed`;
        })
        .filter(Boolean)
        .join(", ");
      if (errorMessages) {
        toast.error(`Please fix the following errors: ${errorMessages}`);
      } else {
        toast.error("Please check the form for errors");
      }
    },
  );

  return (
    <form onSubmit={onFormSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Product title, description, and category</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register("title", { required: "Title is required" })}
              placeholder="Product title"
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Controller
              control={control}
              name="slug"
              render={({ field }) => (
                <Input
                  id="slug"
                  value={field.value ?? ""}
                  placeholder="Auto-generated from title"
                  onChange={(event) => {
                    const normalized = slugify(event.target.value);
                    setIsSlugDirty(true);
                    field.onChange(normalized);
                  }}
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              Leave this blank to auto-generate; only lowercase letters, numbers, and hyphens are
              kept.
            </p>
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Markdown)</Label>
            <MarkdownEditor
              value={watch("description") ?? ""}
              onChange={(value) => setValue("description", value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  defaultValue="sasd"
                >
                  <SelectTrigger
                    id="category"
                    className={errors.category ? "border-destructive" : ""}
                  >
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Product Images</CardTitle>
          <CardDescription>
            Upload product images. First image will be the primary image.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageGalleryUpload images={images} onImagesChange={setImages} />
        </CardContent>
      </Card>

      {/* Product Type */}
      <Card>
        <CardHeader>
          <CardTitle>Product Type</CardTitle>
          <CardDescription>Choose between regular product or auction</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isAuction"
              checked={isAuction}
              onCheckedChange={(checked) => setValue("isAuction", checked as boolean)}
            />
            <Label htmlFor="isAuction">This is an auction product</Label>
          </div>
        </CardContent>
      </Card>

      {/* Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Variants</CardTitle>
          <CardDescription>Product variants (sizes, colors, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <VariantForm
            variants={watch("variants")}
            onVariantsChange={(variants) => setValue("variants", variants as VariantFormData[])}
            isAuction={!!isAuction}
          />
          {errors.variants && (
            <p className="text-sm text-destructive mt-2">{errors.variants.message}</p>
          )}
          {errors.isAuction && (
            <p className="text-sm text-destructive mt-2">{errors.isAuction.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {/* Only show "Save as draft" when creating a new product, not when editing */}
        {isNewProduct && (
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveAsDraft}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save as draft"}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : productId ? "Update Product" : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
