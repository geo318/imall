import { db, tenants } from "@repo/db";
import { desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { superadminGuard } from "../context";

const shopUpdateSchema = z.object({
  canSell: z.boolean(),
});

export const superadminRoutes = new Elysia({ prefix: "/superadmin" })
  .use(superadminGuard)
  .get("/shops", async () => {
    return db
      .select({
        id: tenants.id,
        slug: tenants.shopSlug,
        name: tenants.name,
        canSell: tenants.canSell,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt));
  })
  .patch("/shops/:shopSlug", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const payload = shopUpdateSchema.parse(body);

    await db
      .update(tenants)
      .set({ canSell: payload.canSell })
      .where(eq(tenants.shopSlug, shopSlug));

    const [updated] = await db
      .select({
        id: tenants.id,
        slug: tenants.shopSlug,
        name: tenants.name,
        canSell: tenants.canSell,
      })
      .from(tenants)
      .where(eq(tenants.shopSlug, shopSlug))
      .limit(1);

    if (!updated) {
      return new Response("Shop not found", { status: 404 });
    }

    return updated;
  });
