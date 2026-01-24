/**
 * Data migration script to fix NULL category values before applying NOT NULL constraint
 * Run this before: bun run db:push
 */

import { db, products } from "@repo/db";
import { isNull } from "drizzle-orm";

async function fixNullCategories() {
  console.log("🔍 Checking for products with NULL category...");

  // Find products with NULL category
  const productsWithNullCategory = await db
    .select({ id: products.id, title: products.title })
    .from(products)
    .where(isNull(products.category));

  if (productsWithNullCategory.length === 0) {
    console.log("✅ No products with NULL category found. Migration not needed.");
    return;
  }

  console.log(`📦 Found ${productsWithNullCategory.length} product(s) with NULL category`);

  // Update all NULL categories to "Other" (default category)
  const _result = await db
    .update(products)
    .set({ category: "Other" })
    .where(isNull(products.category));

  console.log(`✅ Updated ${productsWithNullCategory.length} product(s) to category "Other"`);
  console.log("📋 Updated products:");
  productsWithNullCategory.forEach((p) => {
    console.log(`   - ${p.title} (${p.id})`);
  });

  console.log("\n✅ Migration complete! You can now run: bun run db:push");
}

fixNullCategories()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  });
