import { db } from "@repo/db";
import { auctions, products, tenants, variants } from "@repo/db/schema";
import { env } from "@repo/shared";
import { eq } from "drizzle-orm";

const shopSlug = env.SEED_SHOP_SLUG;
const shopName = env.SEED_SHOP_NAME;

async function upsertTenant() {
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shopSlug, shopSlug));

  if (existing?.id) return existing.id;

  const [inserted] = await db
    .insert(tenants)
    .values({ id: crypto.randomUUID(), shopSlug, name: shopName })
    .onConflictDoNothing()
    .returning({ id: tenants.id });

  if (inserted?.id) return inserted.id;

  const [fetched] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shopSlug, shopSlug))
    .limit(1);

  if (!fetched?.id) throw new Error("Failed to upsert tenant");
  return fetched.id;
}

async function seed() {
  const tenantId = await upsertTenant();

  const [product] = await db
    .insert(products)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      slug: "demo-product",
      title: "Demo Product",
      description: "Markdown description for the demo product.",
    })
    .onConflictDoNothing()
    .returning({ id: products.id });

  const [productFallback] = product?.id
    ? []
    : await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.slug, "demo-product"))
        .limit(1);

  const productId = product?.id ?? productFallback?.id;
  if (!productId) throw new Error("Failed to upsert demo product");

  const [variant] = await db
    .insert(variants)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      productId,
      sku: "SKU-DEMO",
      price: "49.99",
      currency: "USD",
    })
    .onConflictDoNothing()
    .returning({ id: variants.id });

  const [variantFallback] = variant?.id
    ? []
    : await db
        .select({ id: variants.id })
        .from(variants)
        .where(eq(variants.productId, productId))
        .limit(1);

  const variantId = variant?.id ?? variantFallback?.id;
  if (!variantId) throw new Error("Failed to upsert demo variant");

  await db
    .insert(auctions)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      variantId,
      status: "active",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3_600_000),
      startingBid: "10",
      minIncrement: "1",
      antiSnipeSeconds: 30,
      buyNowPrice: "60",
    })
    .onConflictDoNothing();

  console.log(`Seed complete for shop '${shopSlug}'`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
