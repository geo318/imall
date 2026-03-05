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

const variantOptionPairSchema = z.object({
  optionKey: z.string(),
  optionName: z.string(),
  optionValue: z.string(),
  valueKey: z.string().optional(),
  optionThumbnail: z.string().optional(),
});

const optionDefinitionSchema = z.object({
  optionKey: z.string(),
  optionName: z.string(),
  sortOrder: z.number(),
});

const variantSchema = z.object({
  id: z.string(),
  sku: z.string().nullable(),
  price: z.string(),
  currency: z.string(),
  availableQty: z.number().optional(),
  optionPairs: z.array(variantOptionPairSchema).optional(),
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
  sellerEmail: z.string().nullable().optional(),
  sellerPhone: z.string().nullable().optional(),
  sellerRules: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  draft: z.boolean().optional(),
  hasAuction: z.boolean().optional(),
  variantCount: z.number().optional(),
  stockTotal: z.number().optional(),
  priceMin: z.number().nullable().optional(),
  currency: z.string().optional(),
  auctionStartingBid: z.number().nullable().optional(),
  auctionCurrentPrice: z.number().nullable().optional(),
  imageUrls: z.string().nullable().optional(),
  images: z.array(imageSchema).optional(),
  optionDefinitions: z.array(optionDefinitionSchema).optional(),
  variants: z.array(variantSchema),
});

export type Product = z.infer<typeof productSchema>;
export type ApiProduct = Product;
