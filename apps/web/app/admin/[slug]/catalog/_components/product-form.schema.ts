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

// Variant schema
export const variantSchema = z.object({
  sku: z.string().optional(),
  price: z
    .string()
    .min(1, "Price is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid number with up to 2 decimal places"),
  currency: z.string().default("USD"),
  isAuction: z.boolean().optional(),
  auctionStartBid: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Auction start bid must be a valid number")
    .optional(),
  auctionMinIncrement: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Auction min increment must be a valid number")
    .optional(),
  auctionBuyNow: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Auction buy now price must be a valid number")
    .optional(),
  auctionStartsAt: z.string().datetime().optional(),
  auctionEndsAt: z.string().datetime().optional(),
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
        (variants) => variants.every((v) => v.price && parseFloat(v.price) > 0),
        "All variants must have a valid price greater than 0",
      ),
  })
  .refine(
    (data) => {
      // If isAuction is true, at least one variant should have auction fields
      if (data.isAuction) {
        return data.variants.some(
          (v) =>
            v.isAuction &&
            v.auctionStartBid &&
            v.auctionEndsAt &&
            new Date(v.auctionEndsAt) > new Date(),
        );
      }
      return true;
    },
    {
      message: "Auction products must have at least one variant with valid auction settings",
      path: ["isAuction"],
    },
  );

// Type inference from schema
export type ProductFormData = z.infer<typeof productFormSchema>;
export type VariantFormData = z.infer<typeof variantSchema>;
export type ImageItem = z.infer<typeof imageItemSchema>;
