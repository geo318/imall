import { db } from "@repo/db";
import { auctions, products, tenants, variants } from "@repo/db/schema";
import { env } from "@repo/shared";
import { and, eq } from "drizzle-orm";

const shopSlug = env.SEED_SHOP_SLUG;
const shopName = env.SEED_SHOP_NAME;

type AuctionSeed = {
  startingBid: string;
  minIncrement: string;
  buyNowPrice?: string;
  durationMinutes: number;
};

type VariantSeed = {
  sku: string;
  price: string;
  currency: string;
  auction?: AuctionSeed;
};

type ProductSeed = {
  slug: string;
  title: string;
  description: string;
  variants: VariantSeed[];
};

const productSeeds: ProductSeed[] = [
  {
    slug: "handcrafted-ceramic-vase",
    title: "Handcrafted Ceramic Vase",
    description: "Minimalist ceramic vase thrown by hand with a satin glaze.",
    variants: [
      {
        sku: "CER-001",
        price: "89.00",
        currency: "USD",
        auction: {
          startingBid: "50.00",
          minIncrement: "5.00",
          buyNowPrice: "120.00",
          durationMinutes: 240,
        },
      },
    ],
  },
  {
    slug: "vintage-leather-messenger-bag",
    title: "Vintage Leather Messenger Bag",
    description: "Full-grain leather bag with brass hardware and padded laptop sleeve.",
    variants: [{ sku: "BAG-001", price: "159.00", currency: "USD" }],
  },
  {
    slug: "limited-edition-art-print",
    title: "Limited Edition Art Print",
    description: "Numbered, signed abstract print on archival paper.",
    variants: [
      {
        sku: "ART-001",
        price: "45.00",
        currency: "USD",
        auction: {
          startingBid: "30.00",
          minIncrement: "2.50",
          buyNowPrice: "90.00",
          durationMinutes: 180,
        },
      },
    ],
  },
  {
    slug: "organic-cotton-throw",
    title: "Organic Cotton Throw Blanket",
    description: "Soft organic cotton throw with a herringbone weave.",
    variants: [{ sku: "THR-001", price: "120.00", currency: "USD" }],
  },
  {
    slug: "handmade-silver-jewelry-set",
    title: "Handmade Silver Jewelry Set",
    description: "925 sterling silver necklace and earrings crafted in small batches.",
    variants: [
      {
        sku: "JEW-001",
        price: "275.00",
        currency: "USD",
        auction: {
          startingBid: "150.00",
          minIncrement: "10.00",
          buyNowPrice: "320.00",
          durationMinutes: 120,
        },
      },
    ],
  },
  {
    slug: "wooden-watch-sustainable-oak",
    title: "Wooden Watch - Sustainable Oak",
    description: "Sustainable oak case with a minimalist dial and leather strap.",
    variants: [{ sku: "WAT-001", price: "195.00", currency: "USD" }],
  },
  {
    slug: "artisanal-candle-collection",
    title: "Artisanal Candle Collection",
    description: "Hand-poured soy candles with essential oil blends.",
    variants: [{ sku: "CND-001", price: "65.00", currency: "USD" }],
  },
  {
    slug: "handwoven-basket-set",
    title: "Handwoven Basket Set",
    description: "Set of three handwoven baskets made from sustainable fibers.",
    variants: [{ sku: "BAS-001", price: "85.00", currency: "USD" }],
  },
  {
    slug: "midnight-desk-set",
    title: "Midnight Desk Set",
    description: "Matte black desk set including tray, pen holder, and catch-all.",
    variants: [{ sku: "DSK-001", price: "210.00", currency: "USD" }],
  },
  {
    slug: "vintage-illustration",
    title: "Vintage Illustration",
    description: "Restored vintage illustration print, museum-grade paper.",
    variants: [
      {
        sku: "ILL-001",
        price: "128.00",
        currency: "USD",
        auction: {
          startingBid: "80.00",
          minIncrement: "5.00",
          buyNowPrice: "180.00",
          durationMinutes: 90,
        },
      },
    ],
  },
  {
    slug: "sculpted-planter-duo",
    title: "Sculpted Planter Duo",
    description: "Pair of sculpted planters with drainage, perfect for shelves.",
    variants: [{ sku: "PLN-001", price: "58.00", currency: "USD" }],
  },
];

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

async function upsertProductWithVariants(tenantId: string) {
  for (const seed of productSeeds) {
    const [product] = await db
      .insert(products)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        slug: seed.slug,
        title: seed.title,
        description: seed.description,
      })
      .onConflictDoNothing()
      .returning({ id: products.id });

    const [productFallback] =
      product?.id !== undefined
        ? []
      : await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.tenantId, tenantId), eq(products.slug, seed.slug)))
          .limit(1);

    const productId = product?.id ?? productFallback?.id;
    if (!productId) throw new Error(`Failed to upsert product ${seed.slug}`);

    for (const variantSeed of seed.variants) {
      const [variant] = await db
        .insert(variants)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          productId,
          sku: variantSeed.sku,
          price: variantSeed.price,
          currency: variantSeed.currency,
        })
        .onConflictDoNothing()
        .returning({ id: variants.id });

      const [variantFallback] =
        variant?.id !== undefined
          ? []
          : await db
              .select({ id: variants.id })
              .from(variants)
              .where(eq(variants.productId, productId))
              .limit(1);

      const variantId = variant?.id ?? variantFallback?.id;
      if (!variantId) throw new Error(`Failed to upsert variant for ${seed.slug}`);

      if (!("auction" in variantSeed) || !variantSeed.auction) continue;

      const auction = variantSeed.auction;
      const startsAt = new Date(Date.now() - 5 * 60_000);
      const endsAt = new Date(startsAt.getTime() + auction.durationMinutes * 60_000);
      await db
        .insert(auctions)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          variantId,
          status: "active",
          startsAt,
          endsAt,
          startingBid: auction.startingBid,
          minIncrement: auction.minIncrement,
          antiSnipeSeconds: 30,
          buyNowPrice: auction.buyNowPrice,
        })
        .onConflictDoNothing();
    }
  }
}

async function seed() {
  const tenantId = await upsertTenant();
  await upsertProductWithVariants(tenantId);
  console.log(`Seed complete for shop '${shopSlug}' with ${productSeeds.length} products`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
