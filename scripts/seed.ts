import { auctions, products, tenants, variants, db } from "@repo/db";
import { eq } from "drizzle-orm";
import { loadServerEnv } from "@repo/shared";

const env = loadServerEnv(process.env);
const shopSlug = process.env.SEED_SHOP_SLUG ?? "demo-shop";
const shopName = process.env.SEED_SHOP_NAME ?? "Demo Shop";

async function upsertTenant() {
  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shopSlug, shopSlug));

  if (existing[0]?.id) return existing[0].id;

  const [inserted] = await db
    .insert(tenants)
    .values({ id: crypto.randomUUID(), shopSlug, name: shopName })
    .returning({ id: tenants.id });
  return inserted.id;
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

  const productId =
    product?.id ??
    (
      await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.slug, "demo-product"))
        .limit(1)
    )[0].id;

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

  const variantId =
    variant?.id ??
    (
      await db
        .select({ id: variants.id })
        .from(variants)
        .where(eq(variants.productId, productId))
        .limit(1)
    )[0].id;

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
