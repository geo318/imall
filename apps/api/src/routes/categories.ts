import { categories, categoryRelations, db } from "@repo/db";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";

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

export const categoriesRoutes = new Elysia({ prefix: "/categories" }).get(
  "/tree",
  async ({ query }) => {
    const locale = categoryLocaleSchema.parse(query?.locale ?? "en");

    const rows = await db
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
      if (!rowsById.has(relation.parentId) || !rowsById.has(relation.childId)) continue;
      childIds.add(relation.childId);
      const current = childrenByParent.get(relation.parentId) ?? [];
      current.push(relation.childId);
      childrenByParent.set(relation.parentId, current);
    }

    const roots = rows.filter((row) => !childIds.has(row.id));

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

      const children: PublicCategoryNode[] = (childrenByParent.get(row.id) ?? [])
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
      categories: roots.map((root) => buildNode(root, new Set())),
    };
  },
);
