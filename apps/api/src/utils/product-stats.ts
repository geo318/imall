import { db, productStats, products } from "@repo/db";
import { eq, sql } from "drizzle-orm";

/**
 * Increment product stat by field name
 */
export async function incrementProductStat(
  productId: string,
  field: "viewsTotal" | "viewsUnique" | "addedToCart" | "loved" | "sold",
  amount = 1,
): Promise<void> {
  // Get product to retrieve tenantId
  const [product] = await db
    .select({ tenantId: products.tenantId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  // Check if stats exist
  const [existingStats] = await db
    .select()
    .from(productStats)
    .where(eq(productStats.productId, productId))
    .limit(1);

  if (existingStats) {
    // Update existing stats
    await db
      .update(productStats)
      .set({
        [field]: sql`${productStats[field]} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(productStats.productId, productId));
  } else {
    // Create new stats
    await db.insert(productStats).values({
      id: crypto.randomUUID(),
      productId,
      tenantId: product.tenantId,
      viewsTotal: field === "viewsTotal" ? amount : 0,
      viewsUnique: field === "viewsUnique" ? amount : 0,
      addedToCart: field === "addedToCart" ? amount : 0,
      loved: field === "loved" ? amount : 0,
      sold: field === "sold" ? amount : 0,
      updatedAt: new Date(),
    });
  }
}

/**
 * Track product view (both total and unique)
 * For unique views, you'd typically use a session/cookie mechanism
 */
export async function trackProductView(productId: string, isUnique = false): Promise<void> {
  await incrementProductStat(productId, "viewsTotal", 1);
  if (isUnique) {
    await incrementProductStat(productId, "viewsUnique", 1);
  }
}

/**
 * Track product added to cart
 */
export async function trackProductAddedToCart(productId: string): Promise<void> {
  await incrementProductStat(productId, "addedToCart", 1);
}

/**
 * Track product loved/favorited
 */
export async function trackProductLoved(productId: string): Promise<void> {
  await incrementProductStat(productId, "loved", 1);
}

/**
 * Track product sold
 */
export async function trackProductSold(productId: string, quantity = 1): Promise<void> {
  await incrementProductStat(productId, "sold", quantity);
}
