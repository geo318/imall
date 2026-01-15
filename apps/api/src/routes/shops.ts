import { db, tenants } from "@repo/db";
import { Elysia } from "elysia";
import { listQuerySchema } from "../context";

export const shopsRoutes = new Elysia({ prefix: "/shops" }).get("/", async ({ query, set }) => {
  try {
    const { limit } = listQuerySchema.parse(query);
    const rows = await db
      .select({
        id: tenants.id,
        slug: tenants.shopSlug,
        name: tenants.name,
      })
      .from(tenants)
      .limit(limit);
    return rows;
  } catch (err) {
    if (err instanceof Response) return err;
    set.status = 500;
    return "Failed to list shops";
  }
});
