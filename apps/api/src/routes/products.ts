import { auctions, db, products, tenants, variants } from "@repo/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { getTenantIdBySlug, listQuerySchema } from "../context";

export const productsRoutes = new Elysia({ prefix: "/shops/:shopSlug/products" })
  .get("/", async ({ params, query, set }) => {
    try {
      const tenantId = await getTenantIdBySlug(params.shopSlug);
      const { limit } = listQuerySchema.parse(query);
      const result = await db.query.products.findMany({
        where: eq(products.tenantId, tenantId),
        with: {
          variants: {
            columns: {
              id: true,
              sku: true,
              price: true,
              currency: true,
            },
          },
        },
        limit,
      });
      return result;
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to list products";
    }
  })
  .get("/:productSlug", async ({ params, set }) => {
    try {
      const tenantId = await getTenantIdBySlug(params.shopSlug);
      const product = await db.query.products.findFirst({
        where: and(eq(products.tenantId, tenantId), eq(products.slug, params.productSlug)),
        with: {
          variants: {
            columns: {
              id: true,
              sku: true,
              price: true,
              currency: true,
            },
          },
        },
      });
      if (!product) {
        set.status = 404;
        return "Product not found";
      }

      const variantIds = product.variants.map((v) => v.id);
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
              })
              .from(auctions)
              .where(inArray(auctions.variantId, variantIds));

      return {
        ...product,
        variants: product.variants.map((variant) => ({
          ...variant,
          auction: variantAuctions.find((a) => a.variantId === variant.id) ?? null,
        })),
      };
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to load product";
    }
  });

export const allProductsRoutes = new Elysia({ prefix: "/products" }).get(
  "/",
  async ({ query, set }) => {
    try {
      const { limit } = listQuerySchema.parse(query);
      const rows = await db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
          tenantSlug: tenants.shopSlug,
          tenantName: tenants.name,
        })
        .from(products)
        .innerJoin(tenants, eq(products.tenantId, tenants.id))
        .orderBy(sql`random()`)
        .limit(limit);

      const results = [];
      for (const row of rows) {
        const [variant] = await db
          .select({
            id: variants.id,
            sku: variants.sku,
            price: variants.price,
            currency: variants.currency,
          })
          .from(variants)
          .where(eq(variants.productId, row.id))
          .limit(1);

        results.push({
          ...row,
          variants: variant ? [variant] : [],
        });
      }
      return results;
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to list products";
    }
  },
);
