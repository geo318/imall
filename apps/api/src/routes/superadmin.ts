import { categoryRelations, categories, db, tenants } from "@repo/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { slugify } from "@repo/shared";
import { superadminGuard } from "../context";

const shopUpdateSchema = z
  .object({
    canSell: z.boolean().optional(),
    canAuction: z.boolean().optional(),
  })
  .refine((value) => value.canSell !== undefined || value.canAuction !== undefined, {
    message: "Missing update fields",
  });

const categoryCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().uuid().optional(),
});

const categoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
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
        canAuction: tenants.canAuction,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt));
  })
  .patch("/shops/:shopSlug", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const payload = shopUpdateSchema.parse(body);

    const updates: Partial<typeof tenants.$inferInsert> = {};
    if (payload.canSell !== undefined) {
      updates.canSell = payload.canSell;
    }
    if (payload.canAuction !== undefined) {
      updates.canAuction = payload.canAuction;
    }

    await db
      .update(tenants)
      .set(updates)
      .where(eq(tenants.shopSlug, shopSlug));

    const [updated] = await db
      .select({
        id: tenants.id,
        slug: tenants.shopSlug,
        name: tenants.name,
        canSell: tenants.canSell,
        canAuction: tenants.canAuction,
      })
      .from(tenants)
      .where(eq(tenants.shopSlug, shopSlug))
      .limit(1);

    if (!updated) {
      return new Response("Shop not found", { status: 404 });
    }

    return updated;
  })
  .get("/categories", async ({ query }) => {
    const includeDeleted = query?.includeDeleted === "true";
    const baseQuery = db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        isActive: categories.isActive,
        deletedAt: categories.deletedAt,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      })
      .from(categories);

    const list = includeDeleted
      ? await baseQuery
      : await baseQuery.where(isNull(categories.deletedAt));

    const relations = await db
      .select({
        parentId: categoryRelations.parentId,
        childId: categoryRelations.childId,
      })
      .from(categoryRelations);

    return { categories: list, relations };
  })
  .post("/categories", async ({ body }) => {
    const payload = categoryCreateSchema.parse(body);
    const slug = payload.slug ? slugify(payload.slug) : slugify(payload.name);

    const [created] = await db
      .insert(categories)
      .values({
        name: payload.name,
        slug,
        description: payload.description,
        isActive: payload.isActive ?? true,
      })
      .returning({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        isActive: categories.isActive,
        deletedAt: categories.deletedAt,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      });

    if (!created) {
      return new Response("Failed to create category", { status: 500 });
    }

    if (payload.parentId) {
      await db.insert(categoryRelations).values({
        parentId: payload.parentId,
        childId: created.id,
      });
    }

    return created;
  })
  .patch("/categories/:categoryId", async ({ params, body }) => {
    const { categoryId } = params as { categoryId: string };
    const payload = categoryUpdateSchema.parse(body);

    const updates: Partial<typeof categories.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.slug !== undefined) updates.slug = slugify(payload.slug);
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.isActive !== undefined) updates.isActive = payload.isActive;

    if (Object.keys(updates).length > 1) {
      await db.update(categories).set(updates).where(eq(categories.id, categoryId));
    }

    if (payload.parentId !== undefined) {
      await db.delete(categoryRelations).where(eq(categoryRelations.childId, categoryId));
      if (payload.parentId) {
        await db.insert(categoryRelations).values({
          parentId: payload.parentId,
          childId: categoryId,
        });
      }
    }

    const [updated] = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        isActive: categories.isActive,
        deletedAt: categories.deletedAt,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!updated) {
      return new Response("Category not found", { status: 404 });
    }

    return updated;
  })
  .delete("/categories/:categoryId", async ({ params }) => {
    const { categoryId } = params as { categoryId: string };
    const [updated] = await db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(categories.id, categoryId), isNull(categories.deletedAt)))
      .returning({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        isActive: categories.isActive,
        deletedAt: categories.deletedAt,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      });

    if (!updated) {
      return new Response("Category not found", { status: 404 });
    }

    return updated;
  });
