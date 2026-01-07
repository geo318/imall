import { db } from "@repo/db";
import { auctions, cartItems, carts, products, tenants, variants } from "@repo/db/schema";
import { env } from "@repo/shared";
import { and, eq } from "drizzle-orm";

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

type ShopSeed = {
  slug: string;
  name: string;
  products: ProductSeed[];
};

const shopSeeds: ShopSeed[] = [
  {
    slug: "demo-shop",
    name: "Demo Shop",
    products: [
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
    ],
  },
  {
    slug: "artisan-crafts",
    name: "Artisan Crafts Co.",
    products: [
      {
        slug: "hand-blown-glass-vase",
        title: "Hand-Blown Glass Vase",
        description: "Unique hand-blown glass vase with organic shapes and colors.",
        variants: [{ sku: "GLAS-001", price: "145.00", currency: "USD" }],
      },
      {
        slug: "leather-bound-journal",
        title: "Leather Bound Journal",
        description: "Premium leather journal with hand-stitched binding and blank pages.",
        variants: [
          {
            sku: "JRN-001",
            price: "75.00",
            currency: "USD",
            auction: {
              startingBid: "40.00",
              minIncrement: "5.00",
              buyNowPrice: "95.00",
              durationMinutes: 120,
            },
          },
        ],
      },
      {
        slug: "copper-mug-set",
        title: "Copper Mug Set",
        description: "Set of four hand-hammered copper mugs, perfect for cocktails.",
        variants: [{ sku: "COP-001", price: "125.00", currency: "USD" }],
      },
    ],
  },
  {
    slug: "modern-minimal",
    name: "Modern Minimal",
    products: [
      {
        slug: "minimalist-wall-clock",
        title: "Minimalist Wall Clock",
        description: "Sleek wall clock with silent movement and minimalist design.",
        variants: [{ sku: "CLK-001", price: "95.00", currency: "USD" }],
      },
      {
        slug: "geometric-planter",
        title: "Geometric Planter",
        description: "Modern geometric planter in matte finish, perfect for succulents.",
        variants: [
          {
            sku: "GEO-001",
            price: "55.00",
            currency: "USD",
            auction: {
              startingBid: "30.00",
              minIncrement: "3.00",
              buyNowPrice: "70.00",
              durationMinutes: 60,
            },
          },
        ],
      },
      {
        slug: "linen-table-runner",
        title: "Linen Table Runner",
        description: "Elegant linen table runner in natural color, hand-finished edges.",
        variants: [{ sku: "LIN-001", price: "68.00", currency: "USD" }],
      },
    ],
  },
];

async function upsertTenant(shopSeed: ShopSeed) {
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shopSlug, shopSeed.slug));

  if (existing?.id) return existing.id;

  const [inserted] = await db
    .insert(tenants)
    .values({ id: crypto.randomUUID(), shopSlug: shopSeed.slug, name: shopSeed.name })
    .onConflictDoNothing()
    .returning({ id: tenants.id });

  if (inserted?.id) return inserted.id;

  const [fetched] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shopSlug, shopSeed.slug))
    .limit(1);

  if (!fetched?.id) throw new Error(`Failed to upsert tenant ${shopSeed.slug}`);
  return fetched.id;
}

async function upsertProductWithVariants(tenantId: string, productSeed: ProductSeed) {
  const [product] = await db
    .insert(products)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      slug: productSeed.slug,
      title: productSeed.title,
      description: productSeed.description,
    })
    .onConflictDoNothing()
    .returning({ id: products.id });

  const [productFallback] =
    product?.id !== undefined
      ? []
      : await db
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.tenantId, tenantId), eq(products.slug, productSeed.slug)))
          .limit(1);

  const productId = product?.id ?? productFallback?.id;
  if (!productId) throw new Error(`Failed to upsert product ${productSeed.slug}`);

  const variantIds: string[] = [];

  for (const variantSeed of productSeed.variants) {
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
    if (!variantId) throw new Error(`Failed to upsert variant for ${productSeed.slug}`);
    variantIds.push(variantId);

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
        antiSnipeSeconds: 300,
        buyNowPrice: auction.buyNowPrice,
        currentPrice: auction.startingBid,
      })
      .onConflictDoNothing();
  }

  return variantIds;
}

async function seedCarts(tenantId: string, variantIds: string[]) {
  if (variantIds.length === 0) return;

  // Create a few sample carts with items
  const cartSeeds = [
    {
      items: [
        { variantIndex: 0, qty: 2 },
        ...(variantIds.length > 1 ? [{ variantIndex: 1, qty: 1 }] : []),
      ],
    },
    ...(variantIds.length > 2
      ? [
          {
            items: [{ variantIndex: 2, qty: 1 }],
          },
        ]
      : []),
  ];

  for (const cartSeed of cartSeeds) {
    if (cartSeed.items.length === 0) continue;

    // Create new cart
    const [newCart] = await db
      .insert(carts)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        status: "open",
      })
      .returning({ id: carts.id });

    if (!newCart?.id) continue;

    // Add items to cart
    for (const item of cartSeed.items) {
      const variantId = variantIds[item.variantIndex];
      if (!variantId) continue;

      await db
        .insert(cartItems)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          cartId: newCart.id,
          variantId,
          qty: item.qty,
        })
        .onConflictDoNothing();
    }
  }
}

async function seed() {
  console.log("Starting seed...");

  for (const shopSeed of shopSeeds) {
    console.log(`\nSeeding shop: ${shopSeed.name} (${shopSeed.slug})`);
    const tenantId = await upsertTenant(shopSeed);

    const allVariantIds: string[] = [];

    for (const productSeed of shopSeed.products) {
      const variantIds = await upsertProductWithVariants(tenantId, productSeed);
      allVariantIds.push(...variantIds);
    }

    // Seed some carts for this shop
    await seedCarts(tenantId, allVariantIds);

    console.log(
      `✓ Seeded ${shopSeed.products.length} products for shop '${shopSeed.slug}'`,
    );
  }

  const totalShops = shopSeeds.length;
  const totalProducts = shopSeeds.reduce((sum, shop) => sum + shop.products.length, 0);
  console.log(`\n✅ Seed complete! ${totalShops} shops, ${totalProducts} products`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
