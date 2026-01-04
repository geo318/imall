import { db, products, variants } from "@repo/db";
import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { getTenantIdBySlug, listQuerySchema } from "../context";

export const productsRoutes = new Elysia({ prefix: "/shops/:shopSlug/products" })
  .get("/", async ({ params, query, set }) => {
    try {
      const tenantId = await getTenantIdBySlug(params.shopSlug);
      const { limit } = listQuerySchema.parse(query);
      const result = await db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
        })
        .from(products)
        .where(eq(products.tenantId, tenantId))
        .limit(limit);
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
      const [product] = await db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
        })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.slug, params.productSlug)))
        .limit(1);
      if (!product) {
        set.status = 404;
        return "Product not found";
      }
      const variantsForProduct = await db
        .select({
          id: variants.id,
          sku: variants.sku,
          price: variants.price,
          currency: variants.currency,
        })
        .from(variants)
        .where(eq(variants.productId, product.id));
      return { ...product, variants: variantsForProduct };
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to load product";
    }
  });
