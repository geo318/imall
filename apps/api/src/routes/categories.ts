import { categories, categoryRelations, db, products, tenants } from "@repo/db";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { withCachedResponse } from "../utils/response-cache";

const categoryLocaleSchema = z.enum(["en", "ka", "ru"]).default("en");

type CategoryRow = {
  id: string;
  slug: string;
  categoryKey: string;
  name: string;
  nameEn: string | null;
  nameKa: string | null;
  nameRu: string | null;
  icon: string;
};

export type PublicCategoryNode = {
  id: string;
  slug: string;
  key: string;
  name: string;
  fallbackName: string;
  icon: string;
  children: PublicCategoryNode[];
};

function pickLocalizedName(category: CategoryRow, locale: z.infer<typeof categoryLocaleSchema>) {
  if (locale === "ka" && category.nameKa?.trim()) return category.nameKa.trim();
  if (locale === "ru" && category.nameRu?.trim()) return category.nameRu.trim();
  if (locale === "en" && category.nameEn?.trim()) return category.nameEn.trim();
  return category.name;
}

export const categoriesRoutes = new Elysia({ prefix: "/categories" })
  .get(
  "/top",
  async ({ query, set }) => {
    const locale = categoryLocaleSchema.parse(query?.locale ?? "en");
    const limit = Math.min(Math.max(1, Number(query?.limit ?? 3) || 3), 20);
    const cacheKey = `categories:top:${locale}:${limit}`;

    const payload = await withCachedResponse(cacheKey, 86_400_000, async () => {
      const rows = await db
        .select({
          key: products.category,
          productCount: count(products.id).as("product_count"),
          name: categories.name,
          nameEn: categories.nameEn,
          nameKa: categories.nameKa,
          nameRu: categories.nameRu,
          categorySlug: categories.slug,
          icon: categories.icon,
        })
        .from(products)
        .innerJoin(tenants, eq(products.tenantId, tenants.id))
        .leftJoin(categories, eq(categories.categoryKey, products.category))
        .where(
          and(
            sql`${products.deletedAt} IS NULL`,
            eq(products.draft, false),
            eq(tenants.canSell, true),
          ),
        )
        .groupBy(
          products.category,
          categories.name,
          categories.nameEn,
          categories.nameKa,
          categories.nameRu,
          categories.slug,
          categories.icon,
        )
        .orderBy(desc(count(products.id)))
        .limit(limit);

      return rows.map((row) => ({
        key: row.key,
        name: pickLocalizedName(
          {
            id: "",
            slug: row.categorySlug ?? row.key,
            categoryKey: row.key,
            name: row.name ?? row.key,
            nameEn: row.nameEn,
            nameKa: row.nameKa,
            nameRu: row.nameRu,
            icon: row.icon ?? "📦",
          },
          locale,
        ),
        icon: row.icon ?? "📦",
        categorySlug: row.categorySlug ?? null,
        productCount: Number(row.productCount),
      }));
    });

    set.headers["Cache-Control"] = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";
    return payload;
  },
)
  .get(
  "/tree",
  async ({ query, set }) => {
    const locale = categoryLocaleSchema.parse(query?.locale ?? "en");
    const payload = await withCachedResponse(
      `categories:tree:${locale}`,
      300_000,
      async () => {
        let rows = await db
          .select({
            id: categories.id,
            slug: categories.slug,
            categoryKey: categories.categoryKey,
            name: categories.name,
            nameEn: categories.nameEn,
            nameKa: categories.nameKa,
            nameRu: categories.nameRu,
            icon: categories.icon,
          })
          .from(categories)
          .where(and(eq(categories.isActive, true), isNull(categories.deletedAt)))
          .orderBy(asc(categories.createdAt), asc(categories.name));

        // Fallback for misconfigured data where categories exist but were left inactive.
        if (rows.length === 0) {
          rows = await db
            .select({
              id: categories.id,
              slug: categories.slug,
              categoryKey: categories.categoryKey,
              name: categories.name,
              nameEn: categories.nameEn,
              nameKa: categories.nameKa,
              nameRu: categories.nameRu,
              icon: categories.icon,
            })
            .from(categories)
            .where(isNull(categories.deletedAt))
            .orderBy(asc(categories.createdAt), asc(categories.name));
        }

        const rowsById = new Map(rows.map((row) => [row.id, row]));
        const relations = await db
          .select({
            parentId: categoryRelations.parentId,
            childId: categoryRelations.childId,
          })
          .from(categoryRelations);

        const childrenByParent = new Map<string, string[]>();
        const childIds = new Set<string>();

        for (const relation of relations) {
          if (relation.parentId === relation.childId) continue;
          if (!rowsById.has(relation.parentId) || !rowsById.has(relation.childId)) continue;
          childIds.add(relation.childId);
          const current = childrenByParent.get(relation.parentId) ?? [];
          current.push(relation.childId);
          childrenByParent.set(relation.parentId, current);
        }

        const roots = rows.filter((row) => !childIds.has(row.id));
        const effectiveRoots = roots.length > 0 ? roots : rows;

        const buildNode = (row: CategoryRow, trail: Set<string>): PublicCategoryNode => {
          if (trail.has(row.id)) {
            return {
              id: row.id,
              slug: row.slug,
              key: row.categoryKey,
              name: pickLocalizedName(row, locale),
              fallbackName: row.name,
              icon: row.icon,
              children: [],
            };
          }

          const nextTrail = new Set(trail);
          nextTrail.add(row.id);

          const childIds = Array.from(new Set(childrenByParent.get(row.id) ?? []));
          const children: PublicCategoryNode[] = childIds
            .map((childId) => rowsById.get(childId))
            .filter((child): child is CategoryRow => Boolean(child))
            .map((child) => buildNode(child, nextTrail));

          return {
            id: row.id,
            slug: row.slug,
            key: row.categoryKey,
            name: pickLocalizedName(row, locale),
            fallbackName: row.name,
            icon: row.icon,
            children,
          };
        };

        return {
          categories: effectiveRoots.map((root) => buildNode(root, new Set())),
        };
      },
    );

    set.headers["Cache-Control"] = "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";
    return payload;
  },
);
