import { db, productStats, products } from "@repo/db";
import { eq, sql } from "drizzle-orm";

const PRODUCT_TENANT_CACHE_LIMIT = 10_000;
const PRODUCT_TENANT_CACHE_TTL_MS = 10 * 60_000;
const productTenantCache = new Map<string, { tenantId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of productTenantCache) {
    if (entry.expiresAt <= now) productTenantCache.delete(key);
  }
}, 60_000).unref();

export type StatsDelta = {
  viewsTotal?: number;
  viewsUnique?: number;
  addedToCart?: number;
  loved?: number;
  sold?: number;
};

async function getProductTenantId(productId: string) {
  const now = Date.now();
  const cached = productTenantCache.get(productId);
  if (cached && cached.expiresAt > now) return cached.tenantId;

  const [product] = await db
    .select({ tenantId: products.tenantId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product?.tenantId) {
    return null;
  }

  if (productTenantCache.size >= PRODUCT_TENANT_CACHE_LIMIT) {
    const firstKey = productTenantCache.keys().next().value;
    if (firstKey) productTenantCache.delete(firstKey);
  }
  productTenantCache.set(productId, { tenantId: product.tenantId, expiresAt: now + PRODUCT_TENANT_CACHE_TTL_MS });

  return product.tenantId;
}

function sanitizeDelta(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}

export async function recordProductStatsDelta(productId: string, delta: StatsDelta): Promise<void> {
  const viewsTotalDelta = sanitizeDelta(delta.viewsTotal);
  const viewsUniqueDelta = sanitizeDelta(delta.viewsUnique);
  const addedToCartDelta = sanitizeDelta(delta.addedToCart);
  const lovedDelta = sanitizeDelta(delta.loved);
  const soldDelta = sanitizeDelta(delta.sold);

  if (
    viewsTotalDelta === 0 &&
    viewsUniqueDelta === 0 &&
    addedToCartDelta === 0 &&
    lovedDelta === 0 &&
    soldDelta === 0
  ) {
    return;
  }

  const tenantId = await getProductTenantId(productId);
  if (!tenantId) return;

  await db
    .insert(productStats)
    .values({
      id: crypto.randomUUID(),
      productId,
      tenantId,
      viewsTotal: viewsTotalDelta,
      viewsUnique: viewsUniqueDelta,
      addedToCart: addedToCartDelta,
      loved: lovedDelta,
      sold: soldDelta,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: productStats.productId,
      set: {
        viewsTotal: sql`${productStats.viewsTotal} + ${viewsTotalDelta}`,
        viewsUnique: sql`${productStats.viewsUnique} + ${viewsUniqueDelta}`,
        addedToCart: sql`${productStats.addedToCart} + ${addedToCartDelta}`,
        loved: sql`${productStats.loved} + ${lovedDelta}`,
        sold: sql`${productStats.sold} + ${soldDelta}`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Track product view (both total and unique)
 * For unique views, you'd typically use a session/cookie mechanism
 */
export async function trackProductView(productId: string, isUnique = false): Promise<void> {
  await recordProductStatsDelta(productId, {
    viewsTotal: 1,
    viewsUnique: isUnique ? 1 : 0,
  });
}

/**
 * Track product added to cart
 */
export async function trackProductAddedToCart(productId: string): Promise<void> {
  await recordProductStatsDelta(productId, { addedToCart: 1 });
}

/**
 * Track product loved/favorited
 */
export async function trackProductLoved(productId: string): Promise<void> {
  await recordProductStatsDelta(productId, { loved: 1 });
}

/**
 * Track product sold
 */
export async function trackProductSold(productId: string, quantity = 1): Promise<void> {
  await recordProductStatsDelta(productId, { sold: quantity });
}
