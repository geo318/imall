import { db, memberships, shopSettings, tenants, users } from "@repo/db";
import { slugify } from "@repo/shared";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { authPlugin, listQuerySchema } from "../context";
import { withCachedResponse } from "../utils/response-cache";
import { ensureAuth, requireAuth } from "../utils/auth";

const createShopSchema = z.object({
  name: z.string().trim().min(1).max(256),
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
