import { z } from "zod";

// Mock categories - can be replaced with real data later
export const MOCK_CATEGORIES = [
  "Electronics",
  "Clothing",
  "Home & Garden",
  "Sports & Outdoors",
  "Books",
  "Toys & Games",
  "Food & Beverages",
  "Health & Beauty",
  "Automotive",
  "Other",
] as const;

// File validation schema for images
// Note: z.file() with .min(), .max(), .mime() is available in Zod 4+
// Currently using Zod 3, so using instanceof(File) with refinements
// To upgrade: replace with z.file().min(10_000).max(10_000_000).mime([...])
export const imageFileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "File is empty")
  .refine((file) => file.size >= 10_000, "File size must be at least 10KB")
  .refine((file) => file.size <= 10_000_000, "File size must be less than 10MB")
  .refine(
    (file) =>
      ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"].includes(file.type),
    "File must be an image (PNG, JPEG, GIF, or WEBP)",
  );

const optionalNumberString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "number") return value.toString();
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Must be a valid number").optional(),
);

const optionalIntegerString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "number") return value.toString();
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z.string().regex(/^\d+$/, "Must be a whole number").optional(),
);

const optionalDateTimeString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z.string().optional(),
);

// Variant schema
export const variantSchema = z.object({
  sku: z.string().optional(),
  price: optionalNumberString,
  currency: z.string().default("USD"),
  isAuction: z.boolean().optional(),
  stock: optionalIntegerString,
  auctionStartBid: optionalNumberString,
  auctionMinIncrement: optionalNumberString,
  auctionBuyNow: optionalNumberString,
  auctionStartsAt: optionalDateTimeString,
  auctionEndsAt: optionalDateTimeString,
});

// Image item schema (for form state)
export const imageItemSchema = z.object({
  id: z.string(),
  url: z.string(),
  isPrimary: z.boolean(),
  file: imageFileSchema.optional(),
  assetId: z.string().optional(),
});

// Product form schema
export const productFormSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(256, "Title must be less than 256 characters"),
    description: z.string().optional(),
    category: z
      .string()
      .min(1, "Category is required")
      .max(128, "Category must be less than 128 characters"),
    slug: z.string().trim().max(128, "Slug must be less than 128 characters").optional(),
    draft: z.boolean().default(false),
    isAuction: z.boolean().default(false),
    variants: z
      .array(variantSchema)
      .min(1, "At least one variant is required")
      .refine(
        (variants) =>
          variants.every((v) => !v.price || (!Number.isNaN(Number(v.price)) && Number(v.price) > 0)),
        "All variants must have a valid price greater than 0",
      ),
  })
  .refine(
    (data) =>
      !data.isAuction ||
      data.variants.length === 0 ||
      data.variants.some(
        (v) =>
          v.auctionStartBid &&
          v.auctionEndsAt &&
          new Date(v.auctionEndsAt) > new Date(),
      ),
    {
      message: "Auction products must have at least one variant with valid auction settings",
      path: ["variants"],
    },
  )
  .refine(
    (data) =>
      data.isAuction ||
      data.variants.length === 0 ||
      data.variants.every((v) => v.price && Number(v.price) > 0),
    {
      message: "All variants must have a valid price greater than 0",
      path: ["variants"],
    },
  );

// Type inference from schema
export type ProductFormData = z.infer<typeof productFormSchema>;
export type VariantFormData = z.infer<typeof variantSchema>;
export type ImageItem = z.infer<typeof imageItemSchema>;
