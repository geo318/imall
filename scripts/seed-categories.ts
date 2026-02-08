import { db } from "@repo/db";
import { categoryRelations, categories } from "@repo/db/schema";
import { slugify } from "@repo/shared";
import { randomUUID } from "node:crypto";

const categorySeeds = [
  {
    name: "Electronics",
    children: [
      { name: "Computers & Tablets" },
      { name: "Phones & Accessories" },
      { name: "Cameras & Photo" },
      { name: "TV, Audio & Video" },
    ],
  },
  {
    name: "Motors",
    children: [
      { name: "Auto Parts & Accessories" },
      { name: "Motorcycles" },
      { name: "Tools & Supplies" },
    ],
  },
  {
    name: "Fashion",
    children: [
      { name: "Women" },
      { name: "Men" },
      { name: "Watches" },
      { name: "Jewelry" },
    ],
  },
  {
    name: "Collectibles & Art",
    children: [{ name: "Trading Cards" }, { name: "Art" }, { name: "Memorabilia" }],
  },
  {
    name: "Home & Garden",
    children: [{ name: "Furniture" }, { name: "Kitchen" }, { name: "Garden" }],
  },
  {
    name: "Sporting Goods",
    children: [{ name: "Outdoor Sports" }, { name: "Fitness" }, { name: "Team Sports" }],
  },
  {
    name: "Toys & Hobbies",
    children: [{ name: "Action Figures" }, { name: "Model Kits" }, { name: "Games" }],
  },
  {
    name: "Business & Industrial",
    children: [{ name: "Office Supplies" }, { name: "Industrial Equipment" }],
  },
];

async function seedCategories() {
  const [existing] = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existing) {
    console.log("Categories already seeded.");
    return;
  }

  const categoryRows: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string;
    isActive: boolean;
  }> = [];
  const relationRows: Array<{ parentId: string; childId: string }> = [];

  for (const parent of categorySeeds) {
    const parentId = randomUUID();
    categoryRows.push({
      id: parentId,
      name: parent.name,
      slug: slugify(parent.name),
      isActive: true,
    });

    for (const child of parent.children) {
      const childId = randomUUID();
      categoryRows.push({
        id: childId,
        name: child.name,
        slug: slugify(child.name),
        isActive: true,
      });
      relationRows.push({ parentId, childId });
    }
  }

  await db.insert(categories).values(categoryRows).onConflictDoNothing();
  if (relationRows.length > 0) {
    await db.insert(categoryRelations).values(relationRows).onConflictDoNothing();
  }

  console.log(`✓ Seeded ${categoryRows.length} categories`);
}

seedCategories()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Category seed failed:", err);
    process.exit(1);
  });
