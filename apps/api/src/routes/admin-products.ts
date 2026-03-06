import {
  assets,
  auctions,
  bids,
  cartItems,
  db,
  inventoryLedger,
  inventorySnapshot,
  productOptionDefinitions,
  productStats,
  products,
  tenants,
  tenantVariantOptions,
  variantOptionValues,
  variants,
} from "@repo/db";
import { INVENTORY_REASONS, normalizeImageUrl, parseImageUrls, slugify } from "@repo/shared";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  not,
  or,
  type SQL,
  sum,
} from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin, getTenantIdBySlug, isSuperadminRequest } from "../context";
import { getStorage } from "../storage";
import { sanitizePersistedImageUrls } from "../utils/image-urls";
import { invalidateCachedResponsesByPrefixes } from "../utils/response-cache";
import { ensureAuth, requireAuth, verifyTenantAccess } from "../utils/auth";

const DEFAULT_CURRENCY = "GEL";

const optionalNumberString = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "number") return value.toString();
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid number")
    .optional(),
);

const optionalIntegerString = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value.toString();
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().regex(/^\d+$/, "Invalid stock quantity").optional());

const optionalDateTimeString = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().optional());

const optionalShortString = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().max(64).optional());

const optionalThumbnailString = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().max(1024).optional());

const optionPairSchema = z.object({
  optionName: z.string().trim().min(1).max(64),
  optionKey: optionalShortString,
  optionValue: z.string().trim().min(1).max(128),
  optionThumbnail: optionalThumbnailString,
});

const productSchema = z
  .object({
    title: z.string().min(1).max(256),
    description: z.string().optional(),
    category: z.string().min(1, "Category is required"),
    slug: z.preprocess((value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }
      return value;
    }, z.string().trim().max(128, "Slug must be less than 128 characters").optional()),
    draft: z.boolean().optional().default(false),
    isAuction: z.boolean().default(false),
    variants: z.array(
      z.object({
        sku: z.string().optional(),
        price: optionalNumberString,
        currency: z.string().default(DEFAULT_CURRENCY),
        isAuction: z.boolean().optional(),
        stock: optionalIntegerString,
        auctionStartBid: optionalNumberString,
        auctionMinIncrement: optionalNumberString,
        auctionBuyNow: optionalNumberString,
        auctionStartsAt: optionalDateTimeString,
        auctionEndsAt: optionalDateTimeString,
        optionPairs: z.array(optionPairSchema).optional().default([]),
      }),
    ),
    images: z
      .array(
        z
          .object({
            id: z.string().optional(),
            url: z.string().optional(),
            file: z.instanceof(File).optional(),
            isPrimary: z.boolean().optional(),
          })
          .refine((data) => data.url || data.file, {
            message: "Either url or file must be provided",
          }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isAuction) {
      const missingPrice = data.variants.some(
        (variant) => !variant.price || Number(variant.price) <= 0,
      );
      if (missingPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants"],
          message: "All variants must have a valid price greater than 0",
        });
      }
    } else {
      const hasValidAuction = data.variants.some(
        (variant) =>
          Boolean(variant.auctionStartBid) &&
          Boolean(variant.auctionEndsAt) &&
          new Date(variant.auctionEndsAt as string) > new Date(),
      );
      if (!hasValidAuction) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["variants"],
          message: "Auction variants require a start bid and a future end time",
        });
      }
    }
  });

type VariantInput = z.infer<typeof productSchema>["variants"][number];
type OptionPairInput = z.infer<typeof optionPairSchema>;

type NormalizedOptionPair = {
  optionKey: string;
  optionName: string;
  optionValue: string;
  valueKey: string;
  optionThumbnail?: string;
};

type PersistVariantOptionsInput = {
  tenantId: string;
  productId: string;
  variantOptionPayloads: Array<{
    variantId: string;
    optionPairs: NormalizedOptionPair[];
  }>;
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0];
};

function invalidatePublicProductCaches(shopSlug: string) {
  invalidateCachedResponsesByPrefixes([
    "products:any:",
    "products:search:",
    `products:shop:${shopSlug}:`,
  ]);
}

function normalizeOptionPairs(optionPairs: OptionPairInput[] | undefined): NormalizedOptionPair[] {
  if (!optionPairs || optionPairs.length === 0) {
    return [];
  }

  const deduped = new Map<string, NormalizedOptionPair>();
  for (const pair of optionPairs) {
    const optionName = pair.optionName.trim();
    const optionValue = pair.optionValue.trim();
    const explicitKey = pair.optionKey?.trim() ?? "";
    const optionKey = slugify(explicitKey || optionName);
    const valueKey = slugify(optionValue);
    const optionThumbnail = pair.optionThumbnail?.trim() || undefined;

    if (!optionName || !optionValue || !optionKey || !valueKey) {
      continue;
    }

    deduped.set(optionKey, {
      optionKey,
      optionName,
      optionValue,
      valueKey,
      optionThumbnail,
    });
  }

  return Array.from(deduped.values());
}

async function persistVariantOptionsForProduct({
  tenantId,
  productId,
  variantOptionPayloads,
  tx,
}: PersistVariantOptionsInput) {
  await tx
    .delete(productOptionDefinitions)
    .where(eq(productOptionDefinitions.productId, productId));

  const orderedProductOptions: Array<{
    optionKey: string;
    optionName: string;
  }> = [];
  const seenOptionKeys = new Set<string>();

  for (const payload of variantOptionPayloads) {
    for (const optionPair of payload.optionPairs) {
      if (seenOptionKeys.has(optionPair.optionKey)) {
        continue;
      }
      seenOptionKeys.add(optionPair.optionKey);
      orderedProductOptions.push({
        optionKey: optionPair.optionKey,
        optionName: optionPair.optionName,
      });
    }
  }

  if (orderedProductOptions.length === 0) {
    return;
  }

  const tenantOptionIdByKey = new Map<string, string>();
  for (const option of orderedProductOptions) {
    const [tenantOption] = await tx
      .insert(tenantVariantOptions)
      .values({
        tenantId,
        optionKey: option.optionKey,
        name: option.optionName,
      })
      .onConflictDoUpdate({
        target: [tenantVariantOptions.tenantId, tenantVariantOptions.optionKey],
        set: {
          name: option.optionName,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: tenantVariantOptions.id,
      });

    if (!tenantOption) {
      continue;
    }
    tenantOptionIdByKey.set(option.optionKey, tenantOption.id);
  }

  const productOptionRows = orderedProductOptions
    .map((option, index) => {
      const tenantOptionId = tenantOptionIdByKey.get(option.optionKey);
      if (!tenantOptionId) {
        return null;
      }
      return {
        tenantId,
        productId,
        tenantOptionId,
        sortOrder: index,
      };
    })
    .filter(Boolean) as Array<{
    tenantId: string;
    productId: string;
    tenantOptionId: string;
    sortOrder: number;
  }>;

  if (productOptionRows.length === 0) {
    return;
  }

  const insertedProductOptions = await tx
    .insert(productOptionDefinitions)
    .values(productOptionRows)
    .returning({
      id: productOptionDefinitions.id,
      tenantOptionId: productOptionDefinitions.tenantOptionId,
    });

  const productOptionIdByKey = new Map<string, string>();
  for (const option of orderedProductOptions) {
    const tenantOptionId = tenantOptionIdByKey.get(option.optionKey);
    if (!tenantOptionId) {
      continue;
    }
    const productOption = insertedProductOptions.find(
      (row) => row.tenantOptionId === tenantOptionId,
    );
    if (productOption) {
      productOptionIdByKey.set(option.optionKey, productOption.id);
    }
  }

  const variantOptionRows = variantOptionPayloads.flatMap((payload) => {
    return payload.optionPairs
      .map((optionPair) => {
        const productOptionId = productOptionIdByKey.get(optionPair.optionKey);
        if (!productOptionId) {
          return null;
        }

        return {
          tenantId,
          variantId: payload.variantId,
          productOptionId,
          value: optionPair.optionValue,
          valueKey: optionPair.valueKey,
          thumbnailUrl: optionPair.optionThumbnail ?? null,
        };
      })
      .filter(Boolean) as Array<{
      tenantId: string;
      variantId: string;
      productOptionId: string;
      value: string;
      valueKey: string;
      thumbnailUrl: string | null;
    }>;
  });

  if (variantOptionRows.length > 0) {
    await tx.insert(variantOptionValues).values(variantOptionRows);
  }
}

function determineSlug({
  requestedSlug,
  title,
  fallback,
}: {
  requestedSlug?: string | null;
  title: string;
  fallback?: string;
}): string {
  const normalizedRequest = slugify(requestedSlug ?? "");
  const normalizedTitle = slugify(title);
  if (normalizedRequest) {
    return normalizedRequest;
  }
  if (normalizedTitle) {
    return normalizedTitle;
  }
  if (fallback) {
    return fallback;
  }
  return crypto.randomUUID().replace(/-/g, "").substring(0, 8);
}

function resolveVariantPrice(variant: VariantInput, isAuction: boolean) {
  if (variant.price) {
    return variant.price;
  }
  if (isAuction) {
    return variant.auctionStartBid || variant.auctionBuyNow || "0";
  }
  return "0";
}

function resolveStockQty(variant: VariantInput, isAuction: boolean) {
  if (isAuction) {
    return 0;
  }
  if (!variant.stock) {
    return 0;
  }
  const qty = Number(variant.stock);
  if (!Number.isFinite(qty) || qty <= 0) {
    return 0;
  }
  return Math.floor(qty);
}

const adminProductsQuerySchema = z.object({
  status: z.enum(["all", "active", "draft", "deleted"]).optional().default("active"),
  search: z.string().trim().optional(),
  sort: z.enum(["createdAt", "title", "price", "stock"]).optional().default("createdAt"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
});

async function getTenantCapabilities(tenantId: string) {
  const [tenant] = await db
    .select({ canSell: tenants.canSell, canAuction: tenants.canAuction })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return {
    canSell: Boolean(tenant?.canSell),
    canAuction: Boolean(tenant?.canAuction),
  };
}

export const adminProductsRoutes = new Elysia({
  prefix: "/admin/:shopSlug/products",
})
  .use(authPlugin)
  .get("/", async ({ params, query, auth, request }) => {
    try {
      // Get tenant ID and verify user has access
      const { shopSlug } = params as { shopSlug: string };
      const tenantId = await getTenantIdBySlug(shopSlug);
      const superadmin = isSuperadminRequest(request);
      if (!superadmin) {
        // Ensure authentication (uses authPlugin or manual verification fallback)
        const effectiveAuth = await ensureAuth(auth, request);
        requireAuth(effectiveAuth);
        if (!effectiveAuth?.userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const hasAccess = await verifyTenantAccess(effectiveAuth.userId, tenantId);

        if (!hasAccess) {
          return Response.json(
            { error: "Forbidden: You don't have access to this shop" },
            {
              status: 403,
            },
          );
        }
      }

      const { status, search, sort, order } = adminProductsQuerySchema.parse(query);

      // Build where clause based on status filter
      const whereConditions: SQL[] = [eq(products.tenantId, tenantId)];
      if (status === "active") {
        whereConditions.push(isNull(products.deletedAt));
        whereConditions.push(eq(products.draft, false));
      } else if (status === "draft") {
        whereConditions.push(isNull(products.deletedAt));
        whereConditions.push(eq(products.draft, true));
      } else if (status === "deleted") {
        whereConditions.push(isNotNull(products.deletedAt));
      }

      if (search) {
        const qLike = `%${search}%`;
        const skuMatches = db
          .select({ productId: variants.productId })
          .from(variants)
          .where(and(eq(variants.tenantId, tenantId), ilike(variants.sku, qLike)));
        const searchCondition = or(
          ilike(products.title, qLike),
          ilike(products.slug, qLike),
          ilike(products.category, qLike),
          inArray(products.id, skuMatches),
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      const productRows = await db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
          category: products.category,
          imageUrls: products.imageUrls,
          status: products.status,
          draft: products.draft,
          deletedAt: products.deletedAt,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(and(...whereConditions));

      if (productRows.length === 0) {
        return [];
      }

      const productIds = productRows.map((product) => product.id);
      const [variantRows, statsRows] = await Promise.all([
        db
          .select({
            id: variants.id,
            productId: variants.productId,
            sku: variants.sku,
            price: variants.price,
            currency: variants.currency,
          })
          .from(variants)
          .where(inArray(variants.productId, productIds)),
        db.select().from(productStats).where(inArray(productStats.productId, productIds)),
      ]);

      const variantIds = variantRows.map((variant) => variant.id);
      const [inventoryRows, auctionRows] = await Promise.all([
        variantIds.length > 0
          ? db
              .select({
                variantId: inventoryLedger.variantId,
                available: sum(inventoryLedger.delta),
              })
              .from(inventoryLedger)
              .where(inArray(inventoryLedger.variantId, variantIds))
              .groupBy(inventoryLedger.variantId)
          : Promise.resolve([]),
        variantIds.length > 0
          ? db
              .select({
                variantId: auctions.variantId,
                startingBid: auctions.startingBid,
                currentPrice: auctions.currentPrice,
                buyNowPrice: auctions.buyNowPrice,
              })
              .from(auctions)
              .where(inArray(auctions.variantId, variantIds))
          : Promise.resolve([]),
      ]);

      const inventoryMap = new Map(
        inventoryRows.map((row) => [row.variantId, Number(row.available ?? 0)]),
      );
      const auctionMap = new Map(auctionRows.map((row) => [row.variantId, row]));
      const statsMap = new Map(statsRows.map((row) => [row.productId, row]));
      const variantsByProductId = new Map<string, typeof variantRows>();

      for (const variant of variantRows) {
        const list = variantsByProductId.get(variant.productId) ?? [];
        list.push(variant);
        variantsByProductId.set(variant.productId, list);
      }

      const productsWithDetails = productRows.map((product) => {
        const productVariants = (variantsByProductId.get(product.id) ?? []).map((variant) => ({
          ...variant,
          availableQty: inventoryMap.has(variant.id)
            ? (inventoryMap.get(variant.id) ?? 0)
            : undefined,
        }));
        const stockTotal = productVariants.reduce((sumQty, variant) => {
          return sumQty + (variant.availableQty ?? 0);
        }, 0);
        const priceValues = productVariants
          .map((variant) => Number(variant.price))
          .filter((value) => Number.isFinite(value));
        const priceMinValue = priceValues.length > 0 ? Math.min(...priceValues) : null;
        const currency =
          productVariants.find((variant) => Number(variant.price) === priceMinValue)?.currency ||
          productVariants[0]?.currency ||
          DEFAULT_CURRENCY;
        const hasAuction = productVariants.some((variant) => auctionMap.has(variant.id));
        const auctionBids = productVariants
          .map((variant) => auctionMap.get(variant.id))
          .filter(Boolean);
        const auctionStartValues = auctionBids
          .map((row) => Number(row?.startingBid))
          .filter((value) => Number.isFinite(value));
        const auctionCurrentValues = auctionBids
          .map((row) => Number(row?.currentPrice ?? row?.startingBid))
          .filter((value) => Number.isFinite(value));

        const statsRow = statsMap.get(product.id);
        const stats = statsRow
          ? {
              viewsTotal: statsRow.viewsTotal || 0,
              viewsUnique: statsRow.viewsUnique || 0,
              addedToCart: statsRow.addedToCart || 0,
              loved: statsRow.loved || 0,
              sold: statsRow.sold || 0,
            }
          : {
              viewsTotal: 0,
              viewsUnique: 0,
              addedToCart: 0,
              loved: 0,
              sold: 0,
            };

        // Get images from comma-delimited string
        const images = sanitizePersistedImageUrls(parseImageUrls(product.imageUrls)).map(
          (url: string, index: number) => ({
            id: `img-${index}`,
            url,
            isPrimary: index === 0,
          }),
        );

        return {
          ...product,
          variants: productVariants,
          variantCount: productVariants.length,
          priceMin: priceMinValue,
          currency,
          stockTotal,
          images,
          stats: {
            viewsTotal: stats.viewsTotal || 0,
            viewsUnique: stats.viewsUnique || 0,
            addedToCart: stats.addedToCart || 0,
            loved: stats.loved || 0,
            sold: stats.sold || 0,
          },
          hasAuction,
          isAuction: hasAuction,
          auctionStartingBid:
            auctionStartValues.length > 0 ? Math.min(...auctionStartValues) : null,
          auctionCurrentPrice:
            auctionCurrentValues.length > 0 ? Math.max(...auctionCurrentValues) : null,
        };
      });

      const direction = order === "asc" ? 1 : -1;
      const sortedProducts = [...productsWithDetails].sort((a, b) => {
        if (sort === "title") {
          return direction * a.title.localeCompare(b.title);
        }
        if (sort === "price") {
          return direction * ((a.priceMin ?? 0) - (b.priceMin ?? 0));
        }
        if (sort === "stock") {
          return direction * ((a.stockTotal ?? 0) - (b.stockTotal ?? 0));
        }
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return direction * (aTime - bTime);
      });

      return sortedProducts;
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("[Admin Products] Error fetching products:", error);
      if (error instanceof Error) {
        console.error("[Admin Products] Error name:", error.name);
        console.error("[Admin Products] Error message:", error.message);
        console.error("[Admin Products] Error stack:", error.stack);

        if (error.name === "TenantNotFound" || error.message.includes("Tenant not found")) {
          return new Response(JSON.stringify({ error: "Shop not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      return new Response(
        JSON.stringify({
          error: "Failed query",
          message: error instanceof Error ? error.message : "Internal server error",
          details:
            error instanceof Error
              ? { name: error.name, stack: error.stack?.substring(0, 500) }
              : undefined,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  })
  .get("/:productId", async ({ params, auth, request }) => {
    try {
      // Get tenant ID and verify user has access
      const { shopSlug, productId } = params as {
        shopSlug: string;
        productId: string;
      };
      const tenantId = await getTenantIdBySlug(shopSlug);
      const superadmin = isSuperadminRequest(request);
      if (!superadmin) {
        // Ensure authentication
        const effectiveAuth = await ensureAuth(auth, request);
        requireAuth(effectiveAuth);
        if (!effectiveAuth?.userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const hasAccess = await verifyTenantAccess(effectiveAuth.userId, tenantId);

        if (!hasAccess) {
          return Response.json(
            { error: "Forbidden: You don't have access to this shop" },
            {
              status: 403,
            },
          );
        }
      }

      const [product] = await db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
          category: products.category,
          imageUrls: products.imageUrls,
          status: products.status,
          tenantId: products.tenantId,
          draft: products.draft,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(
          and(
            eq(products.id, productId),
            eq(products.tenantId, tenantId),
            isNull(products.deletedAt),
          ),
        )
        .limit(1);

      if (!product) {
        return new Response("Product not found", { status: 404 });
      }

      // Get variants and auctions
      const productVariants = await db
        .select({
          id: variants.id,
          sku: variants.sku,
          price: variants.price,
          currency: variants.currency,
        })
        .from(variants)
        .where(eq(variants.productId, product.id));

      // Get auctions for variants
      const variantIds = productVariants.map((v) => v.id);
      const [optionDefinitionRows, variantOptionRows, inventoryRows, variantAuctions] =
        await Promise.all([
          db
            .select({
              optionKey: tenantVariantOptions.optionKey,
              optionName: tenantVariantOptions.name,
              sortOrder: productOptionDefinitions.sortOrder,
            })
            .from(productOptionDefinitions)
            .innerJoin(
              tenantVariantOptions,
              eq(productOptionDefinitions.tenantOptionId, tenantVariantOptions.id),
            )
            .where(eq(productOptionDefinitions.productId, product.id))
            .orderBy(asc(productOptionDefinitions.sortOrder)),
          variantIds.length > 0
            ? db
                .select({
                  variantId: variantOptionValues.variantId,
                  optionKey: tenantVariantOptions.optionKey,
                  optionName: tenantVariantOptions.name,
                  optionValue: variantOptionValues.value,
                  valueKey: variantOptionValues.valueKey,
                  optionThumbnail: variantOptionValues.thumbnailUrl,
                  sortOrder: productOptionDefinitions.sortOrder,
                })
                .from(variantOptionValues)
                .innerJoin(
                  productOptionDefinitions,
                  eq(variantOptionValues.productOptionId, productOptionDefinitions.id),
                )
                .innerJoin(
                  tenantVariantOptions,
                  eq(productOptionDefinitions.tenantOptionId, tenantVariantOptions.id),
                )
                .where(inArray(variantOptionValues.variantId, variantIds))
                .orderBy(asc(productOptionDefinitions.sortOrder))
            : Promise.resolve([]),
          variantIds.length > 0
            ? db
                .select({
                  variantId: inventoryLedger.variantId,
                  available: sum(inventoryLedger.delta),
                })
                .from(inventoryLedger)
                .where(inArray(inventoryLedger.variantId, variantIds))
                .groupBy(inventoryLedger.variantId)
            : Promise.resolve([]),
          variantIds.length > 0
            ? db
                .select()
                .from(auctions)
                .where(
                  and(eq(auctions.tenantId, tenantId), inArray(auctions.variantId, variantIds)),
                )
            : Promise.resolve([]),
        ]);
      const inventoryMap = new Map(
        inventoryRows.map((row) => [row.variantId, Number(row.available ?? 0)]),
      );

      const optionDefinitions = optionDefinitionRows.map((row) => ({
        optionKey: row.optionKey,
        optionName: row.optionName,
        sortOrder: row.sortOrder,
      }));
      const optionPairsByVariant = new Map<
        string,
        Array<{
          optionKey: string;
          optionName: string;
          optionValue: string;
          valueKey: string;
          optionThumbnail?: string;
        }>
      >();
      for (const row of variantOptionRows) {
        const existing = optionPairsByVariant.get(row.variantId) ?? [];
        existing.push({
          optionKey: row.optionKey,
          optionName: row.optionName,
          optionValue: row.optionValue,
          valueKey: row.valueKey,
          optionThumbnail: row.optionThumbnail ?? undefined,
        });
        optionPairsByVariant.set(row.variantId, existing);
      }

      // Get images from comma-delimited string
      const images = sanitizePersistedImageUrls(parseImageUrls(product.imageUrls)).map(
        (url: string, index: number) => ({
          id: `img-${index}`,
          url,
          isPrimary: index === 0,
        }),
      );

      return {
        ...product,
        variants: productVariants.map((v) => {
          const auction = variantAuctions.find((a) => a.variantId === v.id);
          return {
            ...v,
            availableQty: inventoryMap.has(v.id) ? (inventoryMap.get(v.id) ?? 0) : undefined,
            optionPairs: optionPairsByVariant.get(v.id) ?? [],
            auction: auction || null,
          };
        }),
        optionDefinitions,
        images,
        hasAuction: variantAuctions.length > 0,
        isAuction: variantAuctions.length > 0,
      };
    } catch (error) {
      console.error("[Admin Products] Error fetching single product:", error);
      if (error instanceof Response) return error;
      return new Response(
        JSON.stringify({
          error: "Failed to fetch product",
          message: error instanceof Error ? error.message : "Internal server error",
          details:
            error instanceof Error
              ? { name: error.name, stack: error.stack?.substring(0, 500) }
              : undefined,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  })
  .post("/", async ({ params, body, auth, request }) => {
    try {
      // Get tenant ID and verify user has access
      const { shopSlug } = params as { shopSlug: string };
      const tenantId = await getTenantIdBySlug(shopSlug);
      const superadmin = isSuperadminRequest(request);
      if (!superadmin) {
        // Ensure authentication
        const effectiveAuth = await ensureAuth(auth, request);
        requireAuth(effectiveAuth);
        if (!effectiveAuth?.userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const hasAccess = await verifyTenantAccess(effectiveAuth.userId, tenantId);

        if (!hasAccess) {
          return Response.json(
            { error: "Forbidden: You don't have access to this shop" },
            {
              status: 403,
            },
          );
        }
      }
      const capabilities = await getTenantCapabilities(tenantId);
      if (!capabilities.canSell) {
        return Response.json(
          { error: "Selling is disabled for this shop" },
          {
            status: 403,
          },
        );
      }

      const validated = productSchema.parse(body);
      if (validated.isAuction && !capabilities.canAuction) {
        return Response.json(
          { error: "Auctions are disabled for this shop" },
          {
            status: 403,
          },
        );
      }
      const storage = getStorage();

      const slug = determineSlug({
        requestedSlug: validated.slug,
        title: validated.title,
      });

      // Check if slug exists (excluding soft-deleted products)
      const [existing] = await db
        .select()
        .from(products)
        .where(
          and(eq(products.tenantId, tenantId), eq(products.slug, slug), isNull(products.deletedAt)),
        )
        .limit(1);

      if (existing) {
        return new Response("Product with this title already exists", {
          status: 409,
        });
      }

      return await db.transaction(async (tx) => {
        // Upload images and collect URLs first (before creating product)
        const imageUrls: string[] = [];
        if (validated.images) {
          for (const img of validated.images) {
            if (img.url) {
              // Already uploaded image - use the URL directly
              const normalizedUrl = normalizeImageUrl(img.url);
              if (normalizedUrl.length > 0) {
                imageUrls.push(normalizedUrl);
              }
            } else if (img.file) {
              // For new products, upload to temp location first
              // We'll need to update the URLs after product creation
              const tempStorageKey = await storage.upload(img.file as File, shopSlug);
              const tempImageUrl = storage.getUrl(tempStorageKey);
              imageUrls.push(tempImageUrl);

              // Create asset record for tracking (optional)
              await tx.insert(assets).values({
                id: crypto.randomUUID(),
                tenantId,
                storageKey: tempStorageKey,
                mime: (img.file as File).type,
                size: (img.file as File).size,
              });
            }
          }
        }

        const sanitizedImageUrls = sanitizePersistedImageUrls(imageUrls);

        // Create product with image URLs
        const [product] = await tx
          .insert(products)
          .values({
            tenantId,
            slug,
            title: validated.title,
            description: validated.description || null,
            category: validated.category,
            imageUrls: sanitizedImageUrls.length > 0 ? sanitizedImageUrls.join("\n") : null,
            status: "active",
            draft: validated.draft ?? false,
          })
          .returning();

        if (!product) {
          throw new Error("Failed to create product");
        }

        const variantOptionPayloads: Array<{
          variantId: string;
          optionPairs: NormalizedOptionPair[];
        }> = [];

        // Create variants and auctions
        for (const variantData of validated.variants) {
          const resolvedPrice = resolveVariantPrice(variantData, validated.isAuction);
          const normalizedOptionPairs = normalizeOptionPairs(variantData.optionPairs);
          const [variant] = await tx
            .insert(variants)
            .values({
              tenantId,
              productId: product.id,
              sku: variantData.sku || null,
              price: resolvedPrice,
              currency: variantData.currency || DEFAULT_CURRENCY,
            })
            .returning();

          if (!variant) {
            throw new Error("Failed to create variant");
          }

          variantOptionPayloads.push({
            variantId: variant.id,
            optionPairs: normalizedOptionPairs,
          });

          const stockQty = resolveStockQty(variantData, validated.isAuction);
          if (stockQty > 0) {
            await tx.insert(inventoryLedger).values({
              id: crypto.randomUUID(),
              tenantId,
              variantId: variant.id,
              delta: stockQty,
              reason: INVENTORY_REASONS.INIT,
              refType: "initial",
            });
          }

          // Create auction if needed
          if (validated.isAuction && variantData.auctionStartBid) {
            await tx.insert(auctions).values({
              tenantId,
              variantId: variant.id,
              status: "scheduled",
              startsAt: variantData.auctionStartsAt
                ? new Date(variantData.auctionStartsAt)
                : new Date(),
              endsAt: variantData.auctionEndsAt
                ? new Date(variantData.auctionEndsAt)
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              startingBid: variantData.auctionStartBid,
              minIncrement: variantData.auctionMinIncrement || "1.00",
              buyNowPrice: variantData.auctionBuyNow || null,
            });
          }
        }

        await persistVariantOptionsForProduct({
          tx,
          tenantId,
          productId: product.id,
          variantOptionPayloads,
        });

        // Initialize product stats
        await tx.insert(productStats).values({
          productId: product.id,
          tenantId: product.tenantId,
          viewsTotal: 0,
          viewsUnique: 0,
          addedToCart: 0,
          loved: 0,
          sold: 0,
        });

        const created = { id: product.id, slug: product.slug };
        invalidatePublicProductCaches(shopSlug);
        return created;
      });
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("[Admin Products] Error creating product:", error);
      if (
        error instanceof Error &&
        (error.name === "TenantNotFound" || error.message.includes("Tenant not found"))
      ) {
        return new Response(JSON.stringify({ error: "Shop not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  })
  .put("/:productId", async ({ params, body, auth, request }) => {
    try {
      // Get tenant ID and verify user has access
      const { shopSlug, productId } = params as {
        shopSlug: string;
        productId: string;
      };
      const tenantId = await getTenantIdBySlug(shopSlug);
      const superadmin = isSuperadminRequest(request);
      if (!superadmin) {
        // Ensure authentication
        const effectiveAuth = await ensureAuth(auth, request);
        requireAuth(effectiveAuth);
        if (!effectiveAuth?.userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const hasAccess = await verifyTenantAccess(effectiveAuth.userId, tenantId);

        if (!hasAccess) {
          return Response.json(
            { error: "Forbidden: You don't have access to this shop" },
            {
              status: 403,
            },
          );
        }
      }
      const capabilities = await getTenantCapabilities(tenantId);
      if (!capabilities.canSell) {
        return Response.json(
          { error: "Selling is disabled for this shop" },
          {
            status: 403,
          },
        );
      }

      const validated = productSchema.parse(body);
      if (validated.isAuction && !capabilities.canAuction) {
        return Response.json(
          { error: "Auctions are disabled for this shop" },
          {
            status: 403,
          },
        );
      }
      const storage = getStorage();

      return await db.transaction(async (tx) => {
        // Handle images - collect URLs and save as comma-delimited string
        const imageUrls: string[] = [];
        if (validated.images) {
          for (const img of validated.images) {
            if (img.url) {
              // Already uploaded image - use the URL directly
              const normalizedUrl = normalizeImageUrl(img.url);
              if (normalizedUrl.length > 0) {
                imageUrls.push(normalizedUrl);
              }
            } else if (img.file) {
              // Upload file with productId for folder organization
              const storageKey = await storage.upload(img.file, shopSlug, productId);
              const imageUrl = storage.getUrl(storageKey);
              imageUrls.push(imageUrl);

              // Create asset record for tracking (optional)
              await tx.insert(assets).values({
                id: crypto.randomUUID(),
                tenantId,
                storageKey,
                mime: (img.file as File).type,
                size: (img.file as File).size,
              });
            }
          }
        }

        const [existingProduct] = await tx
          .select({ slug: products.slug })
          .from(products)
          .where(
            and(
              eq(products.id, productId),
              eq(products.tenantId, tenantId),
              isNull(products.deletedAt),
            ),
          )
          .limit(1);

        if (!existingProduct) {
          throw new Error("Product not found");
        }

        const slugFromInput = slugify(validated.slug ?? "");
        const titleSlug = slugify(validated.title);
        const existingSlug = slugify(existingProduct.slug ?? "");
        const baseSlug = slugFromInput || titleSlug || existingSlug;
        const fallbackSlug = existingSlug || crypto.randomUUID().replace(/-/g, "").substring(0, 8);
        const slugToStore = baseSlug || fallbackSlug;

        if (slugToStore !== existingSlug) {
          const [conflict] = await tx
            .select()
            .from(products)
            .where(
              and(
                eq(products.tenantId, tenantId),
                eq(products.slug, slugToStore),
                isNull(products.deletedAt),
                not(eq(products.id, productId)),
              ),
            )
            .limit(1);

          if (conflict) {
            throw new Error("Product with this slug already exists");
          }
        }

        const sanitizedImageUrls = sanitizePersistedImageUrls(imageUrls);

        // Update product (only if not soft-deleted)
        await tx
          .update(products)
          .set({
            title: validated.title,
            description: validated.description || null,
            category: validated.category,
            slug: slugToStore,
            imageUrls: sanitizedImageUrls.length > 0 ? sanitizedImageUrls.join("\n") : null,
            draft: validated.draft ?? false,
          })
          .where(
            and(
              eq(products.id, productId),
              eq(products.tenantId, tenantId),
              isNull(products.deletedAt),
            ),
          );

        // Get existing variant IDs before deletion
        const existingVariants = await tx
          .select({ id: variants.id })
          .from(variants)
          .where(eq(variants.productId, productId));

        const existingVariantIds = existingVariants.map((v) => v.id);

        // Delete related records first (due to foreign key constraints)
        if (existingVariantIds.length > 0) {
          // Get auction IDs before deleting them
          const existingAuctions = await tx
            .select({ id: auctions.id })
            .from(auctions)
            .where(inArray(auctions.variantId, existingVariantIds));

          const existingAuctionIds = existingAuctions.map((a) => a.id);

          // Delete bids first (they reference auctions)
          if (existingAuctionIds.length > 0) {
            await tx.delete(bids).where(inArray(bids.auctionId, existingAuctionIds));
          }

          // Delete auctions
          await tx.delete(auctions).where(inArray(auctions.variantId, existingVariantIds));

          // Delete inventory records
          await tx
            .delete(inventoryLedger)
            .where(inArray(inventoryLedger.variantId, existingVariantIds));
          await tx
            .delete(inventorySnapshot)
            .where(inArray(inventorySnapshot.variantId, existingVariantIds));

          // Delete cart items (users will lose items in cart, but that's acceptable for admin updates)
          await tx.delete(cartItems).where(inArray(cartItems.variantId, existingVariantIds));

          // Note: We don't delete orderItems as they represent historical orders
          // If you need to delete variants that have orders, you'll need a different strategy
        }

        // Now delete variants
        await tx.delete(variants).where(eq(variants.productId, productId));

        const variantOptionPayloads: Array<{
          variantId: string;
          optionPairs: NormalizedOptionPair[];
        }> = [];

        for (const variantData of validated.variants) {
          const resolvedPrice = resolveVariantPrice(variantData, validated.isAuction);
          const normalizedOptionPairs = normalizeOptionPairs(variantData.optionPairs);
          const [variant] = await tx
            .insert(variants)
            .values({
              tenantId,
              productId,
              sku: variantData.sku || null,
              price: resolvedPrice,
              currency: variantData.currency || DEFAULT_CURRENCY,
            })
            .returning();

          if (!variant) {
            throw new Error("Failed to create variant");
          }

          variantOptionPayloads.push({
            variantId: variant.id,
            optionPairs: normalizedOptionPairs,
          });

          const stockQty = resolveStockQty(variantData, validated.isAuction);
          if (stockQty > 0) {
            await tx.insert(inventoryLedger).values({
              id: crypto.randomUUID(),
              tenantId,
              variantId: variant.id,
              delta: stockQty,
              reason: INVENTORY_REASONS.INIT,
              refType: "initial",
            });
          }

          if (validated.isAuction && variantData.auctionStartBid) {
            await tx.insert(auctions).values({
              tenantId,
              variantId: variant.id,
              status: "scheduled",
              startsAt: variantData.auctionStartsAt
                ? new Date(variantData.auctionStartsAt)
                : new Date(),
              endsAt: variantData.auctionEndsAt
                ? new Date(variantData.auctionEndsAt)
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              startingBid: variantData.auctionStartBid,
              minIncrement: variantData.auctionMinIncrement || "1.00",
              buyNowPrice: variantData.auctionBuyNow || null,
            });
          }
        }

        await persistVariantOptionsForProduct({
          tx,
          tenantId,
          productId,
          variantOptionPayloads,
        });

        invalidatePublicProductCaches(shopSlug);
        return { id: productId };
      });
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("[Admin Products] Error updating product:", error);
      if (
        error instanceof Error &&
        (error.name === "TenantNotFound" || error.message.includes("Tenant not found"))
      ) {
        return new Response(JSON.stringify({ error: "Shop not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  })
  .delete("/:productId", async ({ params, auth, request }) => {
    try {
      // Get tenant ID and verify user has access
      const { shopSlug, productId } = params as {
        shopSlug: string;
        productId: string;
      };
      const tenantId = await getTenantIdBySlug(shopSlug);
      const superadmin = isSuperadminRequest(request);
      if (!superadmin) {
        // Ensure authentication
        const effectiveAuth = await ensureAuth(auth, request);
        requireAuth(effectiveAuth);
        if (!effectiveAuth?.userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const hasAccess = await verifyTenantAccess(effectiveAuth.userId, tenantId);

        if (!hasAccess) {
          return Response.json(
            { error: "Forbidden: You don't have access to this shop" },
            {
              status: 403,
            },
          );
        }
      }
      const capabilities = await getTenantCapabilities(tenantId);
      if (!capabilities.canSell) {
        return Response.json(
          { error: "Selling is disabled for this shop" },
          {
            status: 403,
          },
        );
      }

      // Soft delete: set deletedAt timestamp instead of actually deleting
      await db
        .update(products)
        .set({ deletedAt: new Date() })
        .where(and(eq(products.id, productId), eq(products.tenantId, tenantId)));

      invalidatePublicProductCaches(shopSlug);
      return { success: true };
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("[Admin Products] Error deleting product:", error);
      if (
        error instanceof Error &&
        (error.name === "TenantNotFound" || error.message.includes("Tenant not found"))
      ) {
        return new Response(JSON.stringify({ error: "Shop not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  });
