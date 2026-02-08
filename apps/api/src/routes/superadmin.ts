import { categoryRelations, categories, db, tenants } from "@repo/db";
import { and, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
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

async function attachHasChildren(
  list: Array<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
) {
  if (list.length === 0) return [];
  const ids = list.map((item) => item.id);
  const childRows = await db
    .select({ parentId: categoryRelations.parentId })
    .from(categoryRelations)
    .where(inArray(categoryRelations.parentId, ids));
  const parentSet = new Set(childRows.map((row) => row.parentId));
  return list.map((item) => ({ ...item, hasChildren: parentSet.has(item.id) }));
}

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
  .get("/categories/roots", async () => {
    const childIds = db.select({ childId: categoryRelations.childId }).from(categoryRelations);
    const roots = await db
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
      .where(and(isNull(categories.deletedAt), notInArray(categories.id, childIds)));

    const withChildren = await attachHasChildren(roots);
    return withChildren.map((category) => ({ ...category, parentId: null }));
  })
  .get("/categories/:categoryId/children", async ({ params }) => {
    const { categoryId } = params as { categoryId: string };
    if (!categoryId || categoryId === "undefined") {
      return new Response("Missing category id", { status: 400 });
    }
    let parentId = categoryId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
      const [parent] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categoryId))
        .limit(1);
      if (!parent) {
        return new Response("Category not found", { status: 404 });
      }
      parentId = parent.id;
    }
    const children = await db
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
      .innerJoin(categoryRelations, eq(categoryRelations.childId, categories.id))
      .where(and(eq(categoryRelations.parentId, parentId), isNull(categories.deletedAt)));

    const withChildren = await attachHasChildren(children);
    return withChildren.map((category) => ({ ...category, parentId }));
  })
  .get("/categories/list", async () => {
    return db
      .select({
        id: categories.id,
        name: categories.name,
      })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .orderBy(desc(categories.createdAt));
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
