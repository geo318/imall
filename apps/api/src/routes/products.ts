import {
  auctions,
  bids,
  db,
  productOptionDefinitions,
  products,
  shopSettings,
  tenants,
  tenantVariantOptions,
  users,
  variantOptionValues,
  variants,
} from "@repo/db";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { getAvailableStockMap, listQuerySchema } from "../context";
import { logger } from "../utils/logger";
import { withCachedResponse } from "../utils/response-cache";

const DEFAULT_CURRENCY = "GEL";

const shopProductsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 20))
    .refine((v) => Number.isFinite(v) && v > 0 && v <= 100, "Limit invalid"),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0))
    .refine((v) => Number.isFinite(v) && v >= 0, "Offset invalid"),
  q: z.string().optional(),
  minPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "minPrice invalid"),
  maxPrice: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "maxPrice invalid"),
  sort: z.enum(["newest", "oldest", "priceAsc", "priceDesc"]).optional().default("newest"),
  categories: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        : [],
    ),
});

type VariantOptionPair = {
  optionKey: string;
  optionName: string;
  optionValue: string;
  valueKey: string;
  optionThumbnail?: string;
};

async function loadVariantOptionDataForProduct(productId: string, variantIds: string[]) {
  const [optionDefinitionRows, variantOptionRows] = await Promise.all([
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
      .where(eq(productOptionDefinitions.productId, productId))
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
  ]);

  const optionDefinitions = optionDefinitionRows.map((row) => ({
    optionKey: row.optionKey,
    optionName: row.optionName,
    sortOrder: row.sortOrder,
  }));

  const optionPairsByVariantId = new Map<string, VariantOptionPair[]>();
  for (const row of variantOptionRows) {
    const existing = optionPairsByVariantId.get(row.variantId) ?? [];
    existing.push({
      optionKey: row.optionKey,
      optionName: row.optionName,
      optionValue: row.optionValue,
      valueKey: row.valueKey,
      optionThumbnail: row.optionThumbnail ?? undefined,
    });
    optionPairsByVariantId.set(row.variantId, existing);
  }

  return {
    optionDefinitions,
    optionPairsByVariantId,
  };
}

function mulberry32(seed: number) {
  let value = seed;
  return function next() {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const output = [...items];
  const random = mulberry32(seed);
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = output[i];
    output[i] = output[j] as T;
    output[j] = tmp as T;
  }
  return output;
}

function timeBucketSeed(bucketMs = 60_000) {
  return Math.floor(Date.now() / bucketMs);
}

export const productsRoutes = new Elysia({
  prefix: "/shops/:shopSlug/products",
})
  .get("/", async ({ params, query, set }) => {
    try {
      const [tenant] = await db
        .select({ id: tenants.id, canSell: tenants.canSell })
        .from(tenants)
        .where(eq(tenants.shopSlug, params.shopSlug))
        .limit(1);

      if (!tenant) {
        set.status = 404;
        return { error: "Shop not found" };
      }

      if (!tenant.canSell) {
        set.status = 403;
        return { error: "Shop not approved for selling" };
      }

      const tenantId = tenant.id;
      const { limit, offset, q, minPrice, maxPrice, sort, categories } =
        shopProductsQuerySchema.parse(query);
      const loadProducts = async () => {
        const qLike = q ? `%${q}%` : undefined;
        const minPriceSql = sql<number>`min(${variants.price})`;

        // Build where clauses - filter out soft-deleted products
        const whereClauses: SQL[] = [eq(products.tenantId, tenantId), isNull(products.deletedAt)];
        if (qLike) {
          const searchCondition = or(
            ilike(products.title, qLike),
            ilike(products.description, qLike),
          );
          if (searchCondition) {
            whereClauses.push(searchCondition);
          }
        }
        if (categories.length > 0) {
          whereClauses.push(inArray(products.category, categories));
        }

        // Build base query
        const baseQuery = db
          .select({
            id: products.id,
            slug: products.slug,
            title: products.title,
            description: products.description,
            category: products.category,
            imageUrls: products.imageUrls,
            status: products.status,
            createdAt: products.createdAt,
            price: minPriceSql,
            currency: sql<string>`min(${variants.currency})`,
          })
          .from(products)
          .innerJoin(variants, eq(variants.productId, products.id))
          .where(and(...whereClauses))
          .groupBy(products.id);

        // HAVING for min/max price
        const havingClauses: SQL[] = [];
        if (minPrice !== undefined) havingClauses.push(gte(minPriceSql, minPrice));
        if (maxPrice !== undefined) havingClauses.push(lte(minPriceSql, maxPrice));
        const filteredQuery =
          havingClauses.length > 0 ? baseQuery.having(and(...havingClauses)) : baseQuery;

        // Apply sorting
        const orderBy =
          sort === "oldest"
            ? asc(products.createdAt)
            : sort === "priceAsc"
              ? asc(minPriceSql)
              : sort === "priceDesc"
                ? desc(minPriceSql)
                : desc(products.createdAt);

        const rows = await filteredQuery.orderBy(orderBy).limit(limit).offset(offset);

        if (rows.length === 0) {
          return {
            items: [],
            nextOffset: null,
          };
        }

        const productIds = rows.map((row) => row.id);

        // Fetch full variants for all products
        const variantRows =
          productIds.length > 0
            ? await db
                .select({
                  id: variants.id,
                  productId: variants.productId,
                  sku: variants.sku,
                  price: variants.price,
                  currency: variants.currency,
                })
                .from(variants)
                .where(inArray(variants.productId, productIds))
            : [];
        type VariantRow = (typeof variantRows)[number];

        // Group variants by product
        const variantsByProduct = new Map<string, VariantRow[]>();
        for (const variant of variantRows) {
          const existing = variantsByProduct.get(variant.productId) ?? [];
          existing.push(variant);
          variantsByProduct.set(variant.productId, existing);
        }

        // Get images from comma-delimited strings in products
        const imagesByProduct = new Map<
          string,
          Array<{ id: string; url: string; isPrimary: boolean }>
        >();
        for (const row of rows) {
          if (row.imageUrls) {
            const imageUrls = row.imageUrls
              .split(",")
              .map((url) => url.trim())
              .filter((url) => url.length > 0);

            imagesByProduct.set(
              row.id,
              imageUrls.map((url, index) => ({
                id: `img-${index}`,
                url,
                isPrimary: index === 0,
              })),
            );
          }
        }

        // Combine products with their variants and images
        const items = rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          category: row.category,
          status: row.status,
          createdAt: row.createdAt,
          variants: variantsByProduct.get(row.id) ?? [],
          images: imagesByProduct.get(row.id) ?? [],
        }));

        return {
          items,
          nextOffset: rows.length < limit ? null : offset + limit,
        };
      };

      const cacheKey = `products:shop:${params.shopSlug}:${limit}:${offset}:${sort}:${minPrice ?? ""}:${maxPrice ?? ""}:${q ?? ""}:${categories.join("|")}`;
      const shouldUseCache = offset === 0 && !q && categories.length <= 4;
      const response = shouldUseCache
        ? await withCachedResponse(cacheKey, 20_000, loadProducts)
        : await loadProducts();

      set.headers["Cache-Control"] = "public, max-age=30, s-maxage=30, stale-while-revalidate=120";
      return response;
    } catch (err) {
      if (err instanceof Response) {
        set.status = err.status;
        return { error: err.statusText || "Not found" };
      }
      console.error("[Products Route] Failed to list products for shop:", params.shopSlug);
      console.error("[Products Route] Error:", err);
      if (err instanceof Error) {
        console.error("[Products Route] Error name:", err.name);
        console.error("[Products Route] Error message:", err.message);
        console.error("[Products Route] Error stack:", err.stack);
      }
      set.status = 500;
      return {
        error: "Failed to list products",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .get("/:productSlug", async ({ params, set }) => {
    try {
      const [tenant] = await db
        .select({ id: tenants.id, canSell: tenants.canSell })
        .from(tenants)
        .where(eq(tenants.shopSlug, params.shopSlug))
        .limit(1);

      if (!tenant) {
        set.status = 404;
        return "Product not found";
      }

      if (!tenant.canSell) {
        set.status = 403;
        return "Shop not approved for selling";
      }

      const tenantId = tenant.id;

      // Fetch product and variants separately for proper typing - exclude soft-deleted products
      const [product] = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.tenantId, tenantId),
            eq(products.slug, params.productSlug),
            isNull(products.deletedAt),
          ),
        )
        .limit(1);

      if (!product) {
        set.status = 404;
        return "Product not found";
      }

      const [sellerProfile] = await db
        .select({
          sellerEmail: shopSettings.sellerEmail,
          sellerPhone: shopSettings.sellerPhone,
          sellerRules: shopSettings.sellerRules,
        })
        .from(shopSettings)
        .where(eq(shopSettings.tenantId, tenantId))
        .limit(1);

      // Fetch variants for this product
      const productVariants = await db
        .select({
          id: variants.id,
          sku: variants.sku,
          price: variants.price,
          currency: variants.currency,
        })
        .from(variants)
        .where(eq(variants.productId, product.id));

      const variantIds = productVariants.map((v) => v.id);
      const { optionDefinitions, optionPairsByVariantId } = await loadVariantOptionDataForProduct(
        product.id,
        variantIds,
      );

      // Fetch auctions for these variants with highest bidder info
      // Use left join to get highestBidderId from the highest bid's user
      const variantAuctions =
        variantIds.length === 0
          ? []
          : await db
              .select({
                id: auctions.id,
                variantId: auctions.variantId,
                status: auctions.status,
                currentPrice: auctions.currentPrice,
                highestBidId: auctions.highestBidId,
                startsAt: auctions.startsAt,
                endsAt: auctions.endsAt,
                startingBid: auctions.startingBid,
                minIncrement: auctions.minIncrement,
                buyNowPrice: auctions.buyNowPrice,
                highestBidderId: users.externalAuthId, // Get from users table via join
              })
              .from(auctions)
              .leftJoin(bids, eq(auctions.highestBidId, bids.id))
              .leftJoin(users, eq(bids.bidderId, users.id))
              .where(inArray(auctions.variantId, variantIds));
      const auctionByVariantId = new Map(
        variantAuctions.map((auction) => [auction.variantId, auction]),
      );

      const availableStockByVariant = await getAvailableStockMap(tenantId, variantIds);

      // Serialize dates to ISO strings for JSON response and add availability
      const serializedVariants = productVariants.map((variant) => {
        const auction = auctionByVariantId.get(variant.id);
        const availableQty = availableStockByVariant.get(variant.id) ?? 0;

        if (!auction) {
          return {
            ...variant,
            optionPairs: optionPairsByVariantId.get(variant.id) ?? [],
            auction: null,
            availableQty,
          };
        }

        // Convert Date objects to ISO strings
        // Note: highestBidderId is stored directly in auctions table (Clerk user ID)
        // It will be null if there's no highest bid yet
        const serializedAuction = {
          id: auction.id,
          variantId: auction.variantId,
          status: auction.status,
          currentPrice: auction.currentPrice,
          highestBidId: auction.highestBidId,
          highestBidderId: auction.highestBidderId ?? null, // Explicitly include even if null
          startsAt:
            auction.startsAt instanceof Date
              ? auction.startsAt.toISOString()
              : String(auction.startsAt),
          endsAt:
            auction.endsAt instanceof Date ? auction.endsAt.toISOString() : String(auction.endsAt),
          startingBid: auction.startingBid,
          minIncrement: auction.minIncrement,
          buyNowPrice: auction.buyNowPrice,
        };

        return {
          ...variant,
          optionPairs: optionPairsByVariantId.get(variant.id) ?? [],
          auction: serializedAuction,
          availableQty,
        };
      });

      // Get images from comma-delimited string
      const images = product.imageUrls
        ? product.imageUrls
            .split(",")
            .map((url, index) => ({
              id: `img-${index}`,
              url: url.trim(),
              isPrimary: index === 0, // First image is primary
            }))
            .filter((img) => img.url.length > 0)
        : [];

      set.headers["Cache-Control"] = "public, max-age=10, s-maxage=10, stale-while-revalidate=30";

      return {
        ...product,
        variants: serializedVariants,
        optionDefinitions,
        images,
        sellerEmail: sellerProfile?.sellerEmail ?? null,
        sellerPhone: sellerProfile?.sellerPhone ?? null,
        sellerRules: sellerProfile?.sellerRules ?? null,
      };
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("Failed to load product:", err);
      if (err instanceof Error) {
        console.error("Error stack:", err.stack);
      }
      set.status = 500;
      return {
        error: "Failed to load product",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

// Helper to extract short ID from product identifier (format: slug-{shortId})
function parseProductIdentifier(identifier: string): { slug: string; shortId: string } | null {
  // Format: product-slug-abc12345 where abc12345 is 8-char short ID
  const parts = identifier.split("-");
  if (parts.length < 2) return null;

  const shortId = parts.at(-1);
  if (shortId?.length !== 8) return null; // Short ID should be 8 chars

  const slug = parts.slice(0, -1).join("-");
  return { slug, shortId };
}

// Helper to get short ID from product UUID (first 8 chars, no dashes)
function getShortId(productId: string): string {
  return productId.replaceAll("-", "").substring(0, 8);
}

export const allProductsRoutes = new Elysia({ prefix: "/products" })
  .get("/", async ({ query, set }) => {
    try {
      const { limit } = listQuerySchema.parse(query);
      const seed = timeBucketSeed();
      const cacheKey = `products:any:${limit}:${seed}`;
      const result = await withCachedResponse(cacheKey, 15_000, async () => {
        type ProductRow = {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          createdAt: Date;
          tenantSlug: string;
          tenantName: string;
        };

        const baseWhere = and(sql`${products.deletedAt} IS NULL`, eq(tenants.canSell, true));

        // Avoid `ORDER BY random()` full-table sort and avoid global COUNT(*) scans.
        // Pull a bounded, indexed "recent window", rotate slightly by time bucket,
        // then do deterministic in-memory shuffle.
        const candidateSize = Math.min(Math.max(limit * 8, limit), 400);
        const windowOffset = (seed % 6) * Math.max(1, Math.floor(limit / 2));

        let candidateRows = (await db
          .select({
            id: products.id,
            slug: products.slug,
            title: products.title,
            description: products.description,
            createdAt: products.createdAt,
            tenantSlug: tenants.shopSlug,
            tenantName: tenants.name,
          })
          .from(products)
          .innerJoin(tenants, eq(products.tenantId, tenants.id))
          .where(baseWhere)
          .orderBy(desc(products.createdAt))
          .limit(candidateSize)
          .offset(windowOffset)) as ProductRow[];

        if (candidateRows.length === 0 && windowOffset > 0) {
          candidateRows = (await db
            .select({
              id: products.id,
              slug: products.slug,
              title: products.title,
              description: products.description,
              createdAt: products.createdAt,
              tenantSlug: tenants.shopSlug,
              tenantName: tenants.name,
            })
            .from(products)
            .innerJoin(tenants, eq(products.tenantId, tenants.id))
            .where(baseWhere)
            .orderBy(desc(products.createdAt))
            .limit(candidateSize)) as ProductRow[];
        }

        const rows = seededShuffle(candidateRows, seed).slice(0, limit);
        logger.debug("[All Products Route] Selected rows", {
          candidateSize,
          windowOffset,
          requestedLimit: limit,
          returned: rows.length,
        });

        if (rows.length === 0) {
          return [];
        }

        const productIds = rows.map((r) => r.id);

        // Fetch all variants for these products, then pick the lowest price one per product
        const allVariants =
          productIds.length > 0
            ? await db
                .select({
                  id: variants.id,
                  productId: variants.productId,
                  sku: variants.sku,
                  price: variants.price,
                  currency: variants.currency,
                })
                .from(variants)
                .where(inArray(variants.productId, productIds))
            : [];

        // Group by product and pick the variant with lowest price
        const variantByProduct = new Map<string, (typeof allVariants)[number]>();
        for (const v of allVariants) {
          const existing = variantByProduct.get(v.productId);
          if (!existing || Number(v.price) < Number(existing.price)) {
            variantByProduct.set(v.productId, v);
          }
        }

        const variantIds = Array.from(variantByProduct.values()).map((v) => v.id);

        const auctionRows =
          variantIds.length === 0
            ? []
            : await db
                .select({
                  id: auctions.id,
                  variantId: auctions.variantId,
                  status: auctions.status,
                  currentPrice: auctions.currentPrice,
                  highestBidId: auctions.highestBidId,
                  startsAt: auctions.startsAt,
                  endsAt: auctions.endsAt,
                  startingBid: auctions.startingBid,
                  minIncrement: auctions.minIncrement,
                  buyNowPrice: auctions.buyNowPrice,
                })
                .from(auctions)
                .where(inArray(auctions.variantId, variantIds));

        const auctionByVariant = new Map<string, (typeof auctionRows)[number]>();
        for (const a of auctionRows) auctionByVariant.set(a.variantId, a);

        return rows.map((row) => {
          const v = variantByProduct.get(row.id);
          const auction = v ? auctionByVariant.get(v.id) : undefined;

          const serializedAuction = auction
            ? {
                ...auction,
                startsAt:
                  auction.startsAt instanceof Date
                    ? auction.startsAt.toISOString()
                    : String(auction.startsAt),
                endsAt:
                  auction.endsAt instanceof Date
                    ? auction.endsAt.toISOString()
                    : String(auction.endsAt),
              }
            : null;

          return {
            ...row,
            hasAuction: Boolean(auction),
            variants: v
              ? [
                  {
                    id: v.id,
                    sku: v.sku,
                    price: v.price,
                    currency: v.currency,
                    auction: serializedAuction,
                  },
                ]
              : [],
          };
        });
      });

      set.headers["Cache-Control"] = "public, max-age=30, s-maxage=30, stale-while-revalidate=120";
      return result;
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("[Products Route] Failed to list all products:", err);
      if (err instanceof Error) {
        console.error("[Products Route] Error name:", err.name);
        console.error("[Products Route] Error message:", err.message);
        console.error("[Products Route] Error stack:", err.stack);
      }
      set.status = 500;
      return {
        error: "Failed to list products",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .get("/search", async ({ query, set }) => {
    const searchSchema = z.object({
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 24))
        .refine((v) => Number.isFinite(v) && v > 0 && v <= 100, "Limit invalid"),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 0))
        .refine((v) => Number.isFinite(v) && v >= 0, "Offset invalid"),
      q: z.string().optional(),
      type: z.enum(["all", "buyNow", "auction"]).optional().default("all"),
      sort: z
        .enum(["newest", "oldest", "priceAsc", "priceDesc", "random"])
        .optional()
        .default("newest"),
      minPrice: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "minPrice invalid"),
      maxPrice: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "maxPrice invalid"),
      categories: z
        .string()
        .optional()
        .transform((value) =>
          value
            ? value
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
            : [],
        ),
    });

    try {
      const { limit, offset, q, type, sort, minPrice, maxPrice, categories } =
        searchSchema.parse(query);
      const randomSeed = sort === "random" ? timeBucketSeed() : 0;
      const cacheKey = `products:search:${limit}:${offset}:${type}:${sort}:${q ?? ""}:${minPrice ?? ""}:${maxPrice ?? ""}:${categories.join("|")}:${randomSeed}`;
      const loadSearch = async () => {
        const qLike = q ? `%${q}%` : undefined;
        const hasAuctionSql = sql<boolean>`
          exists (
            select 1
            from auctions a
            join variants v on v.id = a.variant_id
            where v.product_id = ${products.id}
          )
        `;
        const minPriceSql = sql<number>`min(${variants.price})`;

        const whereClauses: SQL[] = [isNull(products.deletedAt)];
        if (qLike) {
          const searchCondition = or(
            ilike(products.title, qLike),
            ilike(products.description, qLike),
          );
          if (searchCondition) {
            whereClauses.push(searchCondition);
          }
        }
        if (categories.length > 0) {
          whereClauses.push(inArray(products.category, categories));
        }
        if (type === "auction") whereClauses.push(eq(hasAuctionSql, true));
        if (type === "buyNow") whereClauses.push(eq(hasAuctionSql, false));

        // Build base query with aggregates for price and hasAuction.
        const baseQuery = db
          .select({
            id: products.id,
            slug: products.slug,
            title: products.title,
            description: products.description,
            imageUrls: products.imageUrls,
            createdAt: products.createdAt,
            tenantSlug: tenants.shopSlug,
            tenantName: tenants.name,
            price: minPriceSql,
            currency: sql<string>`min(${variants.currency})`,
            hasAuction: hasAuctionSql,
          })
          .from(products)
          .innerJoin(tenants, eq(products.tenantId, tenants.id))
          .innerJoin(variants, eq(variants.productId, products.id))
          .where(and(...whereClauses, eq(tenants.canSell, true)))
          .groupBy(products.id, tenants.shopSlug, tenants.name);

        // HAVING for min/max price
        const havingClauses: SQL[] = [];
        if (minPrice !== undefined) havingClauses.push(gte(minPriceSql, minPrice));
        if (maxPrice !== undefined) havingClauses.push(lte(minPriceSql, maxPrice));
        const filteredQuery =
          havingClauses.length > 0 ? baseQuery.having(and(...havingClauses)) : baseQuery;

        const isRandomSort = sort === "random";
        const orderBy = isRandomSort
          ? desc(products.createdAt)
          : sort === "oldest"
            ? asc(products.createdAt)
            : sort === "priceAsc"
              ? asc(minPriceSql)
              : sort === "priceDesc"
                ? desc(minPriceSql)
                : desc(products.createdAt);

        const rows = await filteredQuery.orderBy(orderBy).limit(limit).offset(offset);
        const orderedRows = isRandomSort ? seededShuffle(rows, randomSeed) : rows;

        // Get images from comma-delimited strings in products
        const imagesByProduct = new Map<
          string,
          Array<{ id: string; url: string; isPrimary: boolean }>
        >();
        for (const row of orderedRows) {
          if (row.imageUrls) {
            const imageUrls = row.imageUrls
              .split(",")
              .map((url) => url.trim())
              .filter((url) => url.length > 0);

            imagesByProduct.set(
              row.id,
              imageUrls.map((url, index) => ({
                id: `img-${index}`,
                url,
                isPrimary: index === 0,
              })),
            );
          }
        }

        const items = orderedRows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          createdAt: row.createdAt,
          tenantSlug: row.tenantSlug,
          tenantName: row.tenantName,
          hasAuction: Boolean(row.hasAuction),
          variants: [
            {
              id: "summary",
              sku: null,
              price: String(row.price ?? "0"),
              currency: row.currency ?? DEFAULT_CURRENCY,
              auction: null,
            },
          ],
          images: imagesByProduct.get(row.id) ?? [],
        }));

        return {
          items,
          nextOffset: orderedRows.length < limit ? null : offset + limit,
        };
      };
      const shouldUseCache = offset === 0 && (q?.length ?? 0) <= 48 && categories.length <= 6;
      const result = shouldUseCache
        ? await withCachedResponse(cacheKey, 20_000, loadSearch)
        : await loadSearch();

      set.headers["Cache-Control"] = "public, max-age=30, s-maxage=30, stale-while-revalidate=120";
      return result;
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return {
        error: "Failed to search products",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .get("/:productIdentifier", async ({ params, set, request }) => {
    try {
      const parsed = parseProductIdentifier(params.productIdentifier);
      if (!parsed) {
        set.status = 400;
        return { error: "Invalid product identifier format" };
      }

      const { slug, shortId } = parsed;

      // Check if user is authenticated and is the owner
      let isOwner = false;
      let includeDeleted = false;

      try {
        const { ensureAuth, verifyTenantAccess } = await import("../utils/auth");
        const effectiveAuth = await ensureAuth(undefined, request);
        if (effectiveAuth?.userId) {
          // Try to find product first to get tenantId
          const [productForTenant] = await db
            .select({
              tenantId: products.tenantId,
              deletedAt: products.deletedAt,
              draft: products.draft,
            })
            .from(products)
            .where(eq(products.slug, slug))
            .limit(1);

          if (productForTenant) {
            const hasAccess = await verifyTenantAccess(
              effectiveAuth.userId,
              productForTenant.tenantId,
            );
            if (hasAccess) {
              isOwner = true;
              includeDeleted = true; // Owner can see deleted products
            }
          }
        }
      } catch {
        // Not authenticated or not owner - continue with normal flow
      }

      // Build where clause - include deleted/draft if owner
      const whereConditions: SQL[] = [eq(products.slug, slug)];
      if (!includeDeleted) {
        whereConditions.push(isNull(products.deletedAt));
      }

      // Find product by slug and verify short ID matches
      const productRows = await db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
          category: products.category,
          imageUrls: products.imageUrls,
          tenantId: products.tenantId,
          status: products.status,
          createdAt: products.createdAt,
          deletedAt: products.deletedAt,
          draft: products.draft,
          tenantSlug: tenants.shopSlug,
          tenantName: tenants.name,
          canSell: tenants.canSell,
        })
        .from(products)
        .innerJoin(tenants, eq(products.tenantId, tenants.id))
        .where(and(...whereConditions))
        .limit(10); // Limit to avoid too many results

      // Find the product where short ID matches
      const product = productRows.find((p) => getShortId(p.id) === shortId);

      if (!product) {
        set.status = 404;
        return "Product not found";
      }

      // If product is deleted or draft and user is not owner, return 404
      if ((product.deletedAt || product.draft) && !isOwner) {
        set.status = 404;
        return "Product not found";
      }

      if (!isOwner && !product.canSell) {
        set.status = 404;
        return "Product not found";
      }

      const [sellerProfile] = await db
        .select({
          sellerEmail: shopSettings.sellerEmail,
          sellerPhone: shopSettings.sellerPhone,
          sellerRules: shopSettings.sellerRules,
        })
        .from(shopSettings)
        .where(eq(shopSettings.tenantId, product.tenantId))
        .limit(1);

      // Fetch variants for this product
      const productVariants = await db
        .select({
          id: variants.id,
          sku: variants.sku,
          price: variants.price,
          currency: variants.currency,
        })
        .from(variants)
        .where(eq(variants.productId, product.id));

      const variantIds = productVariants.map((v) => v.id);
      const { optionDefinitions, optionPairsByVariantId } = await loadVariantOptionDataForProduct(
        product.id,
        variantIds,
      );

      // Fetch auctions for these variants with highest bidder info
      // Use left join to get highestBidderId from the highest bid's user
      const variantAuctions =
        variantIds.length === 0
          ? []
          : await db
              .select({
                id: auctions.id,
                variantId: auctions.variantId,
                status: auctions.status,
                currentPrice: auctions.currentPrice,
                highestBidId: auctions.highestBidId,
                startsAt: auctions.startsAt,
                endsAt: auctions.endsAt,
                startingBid: auctions.startingBid,
                minIncrement: auctions.minIncrement,
                buyNowPrice: auctions.buyNowPrice,
                highestBidderId: users.externalAuthId, // Get from users table via join
              })
              .from(auctions)
              .leftJoin(bids, eq(auctions.highestBidId, bids.id))
              .leftJoin(users, eq(bids.bidderId, users.id))
              .where(inArray(auctions.variantId, variantIds));
      const auctionByVariantId = new Map(
        variantAuctions.map((auction) => [auction.variantId, auction]),
      );

      // Serialize dates to ISO strings for JSON response
      const serializedVariants = productVariants.map((variant) => {
        const auction = auctionByVariantId.get(variant.id);

        if (!auction) {
          return {
            ...variant,
            optionPairs: optionPairsByVariantId.get(variant.id) ?? [],
            auction: null,
          };
        }

        // Convert Date objects to ISO strings
        // Note: highestBidderId is stored in auctions table, or fetched from bid via COALESCE
        // It will be null if there's no highest bid yet
        const serializedAuction = {
          id: auction.id,
          variantId: auction.variantId,
          status: auction.status,
          currentPrice: auction.currentPrice,
          highestBidId: auction.highestBidId,
          highestBidderId: auction.highestBidderId ?? null, // Explicitly include even if null
          startsAt:
            auction.startsAt instanceof Date
              ? auction.startsAt.toISOString()
              : String(auction.startsAt),
          endsAt:
            auction.endsAt instanceof Date ? auction.endsAt.toISOString() : String(auction.endsAt),
          startingBid: auction.startingBid,
          minIncrement: auction.minIncrement,
          buyNowPrice: auction.buyNowPrice,
        };

        return {
          ...variant,
          optionPairs: optionPairsByVariantId.get(variant.id) ?? [],
          auction: serializedAuction,
        };
      });

      // Get images from comma-delimited string
      const images = product.imageUrls
        ? product.imageUrls
            .split(",")
            .map((url, index) => ({
              id: `img-${index}`,
              url: url.trim(),
              isPrimary: index === 0, // First image is primary
            }))
            .filter((img) => img.url.length > 0)
        : [];

      set.headers["Cache-Control"] = "public, max-age=10, s-maxage=10, stale-while-revalidate=30";

      return {
        ...product,
        variants: serializedVariants,
        optionDefinitions,
        images,
        sellerEmail: sellerProfile?.sellerEmail ?? null,
        sellerPhone: sellerProfile?.sellerPhone ?? null,
        sellerRules: sellerProfile?.sellerRules ?? null,
        deletedAt: product.deletedAt
          ? product.deletedAt instanceof Date
            ? product.deletedAt.toISOString()
            : String(product.deletedAt)
          : null,
        draft: product.draft ?? false,
      };
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("Failed to load product:", err);
      if (err instanceof Error) {
        console.error("Error stack:", err.stack);
      }
      set.status = 500;
      return {
        error: "Failed to load product",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .post("/:productIdentifier/track-view", async ({ params, body }) => {
    try {
      const parsed = parseProductIdentifier(params.productIdentifier);
      let productId: string;

      if (!parsed) {
        // If it's a UUID, use it directly
        productId = params.productIdentifier;
      } else {
        const { slug, shortId } = parsed;

        // Find product by slug
        const productRows = await db
          .select({
            id: products.id,
            slug: products.slug,
          })
          .from(products)
          .where(and(eq(products.slug, slug), sql`${products.deletedAt} IS NULL`))
          .limit(10);

        // Find the product where short ID matches
        const product = productRows.find((p) => getShortId(p.id) === shortId);

        if (!product) {
          return { success: false, error: "Product not found" };
        }

        productId = product.id;
      }

      // Parse request body to check if this is a unique view
      let isUnique = false;
      try {
        if (body && typeof body === "object") {
          const bodyObj = body as { isUnique?: boolean };
          isUnique = bodyObj.isUnique ?? false;
        }
      } catch {
        // If body parsing fails, default to non-unique
        isUnique = false;
      }

      const { enqueueProductStatsDelta } = await import("../utils/product-stats-queue");
      enqueueProductStatsDelta(productId, {
        viewsTotal: 1,
        viewsUnique: isUnique ? 1 : 0,
      });
      return { success: true };
    } catch (error) {
      console.error("[Products] Error tracking view:", error);
      // Don't fail the request - view tracking is not critical
      return { success: false };
    }
  });
