import { auctions, bids, db, products, tenants, users, variants } from "@repo/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { getAvailableStock, getTenantIdBySlug, listQuerySchema } from "../context";

export const productsRoutes = new Elysia({
  prefix: "/shops/:shopSlug/products",
})
  .get("/", async ({ params, query, set }) => {
    try {
      console.log("[Products Route] Fetching products for shop:", params.shopSlug);
      console.log("[Products Route] Query params:", query);

      const tenantId = await getTenantIdBySlug(params.shopSlug);
      console.log("[Products Route] Tenant ID:", tenantId);

      const { limit } = listQuerySchema.parse(query);
      console.log("[Products Route] Limit:", limit);

      // Fetch products
      console.log("[Products Route] Executing products query...");
      const productRows = await db
        .select()
        .from(products)
        .where(eq(products.tenantId, tenantId))
        .limit(limit);

      if (productRows.length === 0) {
        return [];
      }

      const productIds = productRows.map((p) => p.id);

      // Fetch variants for all products
      type VariantRow = {
        id: string;
        productId: string;
        sku: string | null;
        price: string;
        currency: string;
      };

      const variantRows: VariantRow[] =
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

      // Group variants by product
      const variantsByProduct = new Map<string, VariantRow[]>();
      for (const variant of variantRows) {
        const existing = variantsByProduct.get(variant.productId) ?? [];
        existing.push(variant);
        variantsByProduct.set(variant.productId, existing);
      }

      // Combine products with their variants
      const result = productRows.map((product) => ({
        ...product,
        variants: variantsByProduct.get(product.id) ?? [],
      }));

      return result;
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
        // Check if it's a tenant not found error
        if (err.name === "TenantNotFound" || err.message.includes("Tenant not found")) {
          set.status = 404;
          return {
            error: "Shop not found",
            message: "The requested shop does not exist",
          };
        }
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
      const tenantId = await getTenantIdBySlug(params.shopSlug);

      // Fetch product and variants separately for proper typing
      const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.slug, params.productSlug)))
        .limit(1);

      if (!product) {
        set.status = 404;
        return "Product not found";
      }

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

      // Serialize dates to ISO strings for JSON response and add availability
      const serializedVariants = await Promise.all(
        productVariants.map(async (variant) => {
          const auction = variantAuctions.find((a) => a.variantId === variant.id);
          const availableQty = await getAvailableStock(product.tenantId, variant.id);

          if (!auction) {
            return {
              ...variant,
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
              auction.endsAt instanceof Date
                ? auction.endsAt.toISOString()
                : String(auction.endsAt),
            startingBid: auction.startingBid,
            minIncrement: auction.minIncrement,
            buyNowPrice: auction.buyNowPrice,
          };

          return {
            ...variant,
            auction: serializedAuction,
            availableQty,
          };
        }),
      );

      return {
        ...product,
        variants: serializedVariants,
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
      console.log("[All Products Route] Starting request");
      const { limit } = listQuerySchema.parse(query);
      console.log("[All Products Route] Limit:", limit);

      let rows: Array<{
        id: string;
        slug: string;
        title: string;
        description: string | null;
        createdAt: Date;
        tenantSlug: string;
        tenantName: string;
      }> = [];
      try {
        rows = await db
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
          .orderBy(sql`random()`)
          .limit(limit);
        console.log("[All Products Route] Query succeeded, got", rows.length, "rows");
      } catch (queryErr) {
        console.error("[All Products Route] Query failed:", queryErr);
        throw queryErr;
      }

      if (rows.length === 0) return [];

      const productIds = rows.map((r) => r.id);
      console.log("[All Products Route] Product IDs:", productIds.length);

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

      console.log("[All Products Route] Found variants:", allVariants.length);

      // Group by product and pick the variant with lowest price
      const variantByProduct = new Map<string, (typeof allVariants)[number]>();
      for (const v of allVariants) {
        const existing = variantByProduct.get(v.productId);
        if (!existing || Number(v.price) < Number(existing.price)) {
          variantByProduct.set(v.productId, v);
        }
      }

      const variantIds = Array.from(variantByProduct.values()).map((v) => v.id);
      console.log("[All Products Route] Variant IDs for auctions:", variantIds.length);

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

      console.log("[All Products Route] Found auctions:", auctionRows.length);

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
    });

    try {
      const { limit, offset, q, type, sort, minPrice, maxPrice } = searchSchema.parse(query);

      const qLike = q ? `%${q}%` : null;
      const hasAuctionSql = sql<boolean>`
        exists (
          select 1
          from auctions a
          join variants v on v.id = a.variant_id
          where v.product_id = ${products.id}
        )
      `;
      const minPriceSql = sql<number>`min(${variants.price})`;

      const whereClauses: any[] = [];
      if (qLike) {
        whereClauses.push(
          sql`(${products.title} ILIKE ${qLike} OR ${products.description} ILIKE ${qLike})`,
        );
      }
      if (type === "auction") whereClauses.push(sql`${hasAuctionSql} = true`);
      if (type === "buyNow") whereClauses.push(sql`${hasAuctionSql} = false`);

      // Build base query with aggregates for price and hasAuction.
      let base = db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
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
        .groupBy(products.id, tenants.shopSlug, tenants.name);

      if (whereClauses.length > 0) {
        // drizzle-orm types are strict; use raw sql for combined where
        base = (base as any).where(sql.join(whereClauses, sql` AND `));
      }

      // HAVING for min/max price
      const havingClauses: any[] = [];
      if (minPrice !== undefined) havingClauses.push(sql`${minPriceSql} >= ${minPrice}`);
      if (maxPrice !== undefined) havingClauses.push(sql`${minPriceSql} <= ${maxPrice}`);
      if (havingClauses.length > 0) {
        base = (base as any).having(sql.join(havingClauses, sql` AND `));
      }

      if (sort === "random") base = (base as any).orderBy(sql`random()`);
      if (sort === "newest") base = (base as any).orderBy(sql`${products.createdAt} desc`);
      if (sort === "oldest") base = (base as any).orderBy(sql`${products.createdAt} asc`);
      if (sort === "priceAsc") base = (base as any).orderBy(sql`${minPriceSql} asc`);
      if (sort === "priceDesc") base = (base as any).orderBy(sql`${minPriceSql} desc`);

      const rows = await (base as any).limit(limit).offset(offset);

      const items = rows.map((r: any) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        createdAt: r.createdAt,
        tenantSlug: r.tenantSlug,
        tenantName: r.tenantName,
        hasAuction: Boolean(r.hasAuction),
        variants: [
          {
            id: "summary",
            sku: null,
            price: String(r.price ?? "0"),
            currency: r.currency ?? "USD",
            auction: null,
          },
        ],
      }));

      return {
        items,
        nextOffset: rows.length < limit ? null : offset + limit,
      };
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return {
        error: "Failed to search products",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .get("/:productIdentifier", async ({ params, set }) => {
    try {
      const parsed = parseProductIdentifier(params.productIdentifier);
      if (!parsed) {
        set.status = 400;
        return { error: "Invalid product identifier format" };
      }

      const { slug, shortId } = parsed;

      // Find product by slug and verify short ID matches
      const productRows = await db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
          tenantId: products.tenantId,
          status: products.status,
          createdAt: products.createdAt,
          tenantSlug: tenants.shopSlug,
          tenantName: tenants.name,
        })
        .from(products)
        .innerJoin(tenants, eq(products.tenantId, tenants.id))
        .where(eq(products.slug, slug))
        .limit(10); // Limit to avoid too many results

      // Find the product where short ID matches
      const product = productRows.find((p) => getShortId(p.id) === shortId);

      if (!product) {
        set.status = 404;
        return "Product not found";
      }

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

      // Serialize dates to ISO strings for JSON response
      const serializedVariants = productVariants.map((variant) => {
        const auction = variantAuctions.find((a) => a.variantId === variant.id);

        if (!auction) {
          return {
            ...variant,
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
          auction: serializedAuction,
        };
      });

      return {
        ...product,
        variants: serializedVariants,
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
