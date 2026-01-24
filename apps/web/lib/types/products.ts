import { z } from "zod";

const auctionSchema = z.object({
  id: z.string(),
  status: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
  startingBid: z.string().nullable().optional(),
  minIncrement: z.string().nullable().optional(),
  buyNowPrice: z.string().nullable().optional(),
  currentPrice: z.string().nullable().optional(),
  highestBidId: z.string().nullable().optional(),
  highestBidderId: z.string().nullable().optional(),
});

const variantSchema = z.object({
  id: z.string(),
  sku: z.string().nullable(),
  price: z.string(),
  currency: z.string(),
  availableQty: z.number().optional(),
  auction: auctionSchema.nullable().optional(),
});

const imageSchema = z.object({
  id: z.string(),
  url: z.string(),
  isPrimary: z.boolean(),
});

export const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().optional(),
  status: z.string().optional(),
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
  tenantName: z.string().optional(),
  createdAt: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  hasAuction: z.boolean().optional(),
  imageUrls: z.string().nullable().optional(),
  images: z.array(imageSchema).optional(),
  variants: z.array(variantSchema),
});

export type Product = z.infer<typeof productSchema>;
export type ApiProduct = Product;
