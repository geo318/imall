import { db, memberships, orderItems, products, shopSettings, tenants, users } from "@repo/db";
import { slugify } from "@repo/shared";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin, listQuerySchema } from "../context";
import { withCachedResponse } from "../utils/response-cache";
import { ensureAuth, requireAuth } from "../utils/auth";

const createShopSchema = z.object({
  name: z.string().trim().min(1).max(256),
});

const spotlightQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 4))
    .refine((value) => Number.isFinite(value) && value > 0 && value <= 12, "Limit invalid"),
});

async function slugExists(slug: string) {
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shopSlug, slug))
    .limit(1);
  return Boolean(existing?.id);
}

async function generateUniqueShopSlug(name: string) {
  const base = slugify(name) || "shop";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
    const candidate = `${base}-${suffix}`;
    if (!(await slugExists(candidate))) {
      return candidate;
    }
  }
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export const shopsRoutes = new Elysia({ prefix: "/shops" })
  .use(authPlugin)
  .get("/", async ({ query, set }) => {
    try {
      const { limit } = listQuerySchema.parse(query);
      const rows = await withCachedResponse(`shops:list:${limit}`, 60_000, async () => {
        return db
          .select({
            id: tenants.id,
            slug: tenants.shopSlug,
            name: tenants.name,
          })
          .from(tenants)
          .where(eq(tenants.canSell, true))
          .limit(limit);
      });
      set.headers["Cache-Control"] = "public, max-age=120, s-maxage=120, stale-while-revalidate=600";
      return rows;
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to list shops";
    }
  })
  .get("/spotlight", async ({ query, set }) => {
    try {
      const { limit } = spotlightQuerySchema.parse(query);

      const rows = await withCachedResponse(`shops:spotlight:${limit}`, 60_000, async () => {
        const productCounts = db
          .select({
            tenantId: products.tenantId,
            productCount: sql<number>`count(*)::int`,
          })
          .from(products)
          .where(isNull(products.deletedAt))
          .groupBy(products.tenantId)
          .as("product_counts");

        const salesCounts = db
          .select({
            tenantId: orderItems.tenantId,
            salesCount: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int`,
          })
          .from(orderItems)
          .groupBy(orderItems.tenantId)
          .as("sales_counts");

        const spotlightRows = await db
          .select({
            id: tenants.id,
            slug: tenants.shopSlug,
            name: tenants.name,
            productCount: sql<number>`coalesce(${productCounts.productCount}, 0)::int`,
            salesCount: sql<number>`coalesce(${salesCounts.salesCount}, 0)::int`,
          })
          .from(tenants)
          .leftJoin(productCounts, eq(productCounts.tenantId, tenants.id))
          .leftJoin(salesCounts, eq(salesCounts.tenantId, tenants.id))
          .where(eq(tenants.canSell, true))
          .orderBy(
            desc(sql<number>`coalesce(${salesCounts.salesCount}, 0)`),
            desc(sql<number>`coalesce(${productCounts.productCount}, 0)`),
            desc(tenants.createdAt),
          )
          .limit(limit);

        if (spotlightRows.length === 0) {
          return [];
        }

        const tenantIds = spotlightRows.map((row) => row.id);

        const categoryRows = await db
          .select({
            tenantId: products.tenantId,
            category: products.category,
            itemCount: sql<number>`count(*)::int`,
          })
          .from(products)
          .where(and(inArray(products.tenantId, tenantIds), isNull(products.deletedAt)))
          .groupBy(products.tenantId, products.category)
          .orderBy(desc(sql<number>`count(*)`));

        const topCategoryByTenant = new Map<string, string>();
        for (const row of categoryRows) {
          if (!topCategoryByTenant.has(row.tenantId) && row.category) {
            topCategoryByTenant.set(row.tenantId, row.category);
          }
        }

        return spotlightRows.map((row) => ({
          ...row,
          primaryCategory: topCategoryByTenant.get(row.id) ?? null,
        }));
      });

      set.headers["Cache-Control"] = "public, max-age=120, s-maxage=120, stale-while-revalidate=600";
      return rows;
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return { error: err instanceof Error ? err.message : "Failed to load spotlight shops" };
    }
  })
  .get("/mine", async ({ auth, request, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      const { userId } = requireAuth(effectiveAuth);

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalAuthId, userId))
        .limit(1);

      if (!user?.id) {
        return [];
      }

      const rows = await db
        .select({
          id: tenants.id,
          slug: tenants.shopSlug,
          name: tenants.name,
          canSell: tenants.canSell,
          role: memberships.role,
        })
        .from(memberships)
        .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
        .where(eq(memberships.userId, user.id));

      return rows;
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return { error: err instanceof Error ? err.message : "Failed to load shops" };
    }
  })
  .get("/:shopSlug/profile", async ({ params, set }) => {
    try {
      const { shopSlug } = params as { shopSlug: string };
      const row = await withCachedResponse(`shops:profile:${shopSlug}`, 60_000, async () => {
        const [value] = await db
          .select({
            id: tenants.id,
            slug: tenants.shopSlug,
            name: tenants.name,
            canSell: tenants.canSell,
            sellerEmail: shopSettings.sellerEmail,
            sellerPhone: shopSettings.sellerPhone,
            sellerRules: shopSettings.sellerRules,
          })
          .from(tenants)
          .leftJoin(shopSettings, eq(shopSettings.tenantId, tenants.id))
          .where(eq(tenants.shopSlug, shopSlug))
          .limit(1);
        return value ?? null;
      });

      if (!row || !row.canSell) {
        set.status = 404;
        return { error: "Shop not found" };
      }

      set.headers["Cache-Control"] = "public, max-age=120, s-maxage=120, stale-while-revalidate=600";
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        sellerEmail: row.sellerEmail ?? null,
        sellerPhone: row.sellerPhone ?? null,
        sellerRules: row.sellerRules ?? null,
      };
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return { error: err instanceof Error ? err.message : "Failed to load shop profile" };
    }
  })
  .post("/register", async ({ auth, body, request, set }) => {
    try {
      const payload = createShopSchema.parse(body);
      const effectiveAuth = await ensureAuth(auth, request);
      const { userId } = requireAuth(effectiveAuth);

      let [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalAuthId, userId))
        .limit(1);

      if (!user) {
        const [createdUser] = await db
          .insert(users)
          .values({
            id: crypto.randomUUID(),
            externalAuthId: userId,
          })
          .returning({ id: users.id });
        user = createdUser;
      }

      if (!user?.id) {
        set.status = 500;
        return { error: "Failed to create user record" };
      }

      const shopSlug = await generateUniqueShopSlug(payload.name);

      const [createdTenant] = await db
        .insert(tenants)
        .values({
          id: crypto.randomUUID(),
          shopSlug,
          name: payload.name,
          canSell: false,
        })
        .returning({
          id: tenants.id,
          slug: tenants.shopSlug,
          name: tenants.name,
          canSell: tenants.canSell,
        });

      if (!createdTenant?.id) {
        set.status = 500;
        return { error: "Failed to create shop" };
      }

      await db.insert(memberships).values({
        userId: user.id,
        tenantId: createdTenant.id,
        role: "admin",
      });

      return createdTenant;
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return { error: err instanceof Error ? err.message : "Failed to register shop" };
    }
  });
