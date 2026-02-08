import { db } from "@repo/db";
import {
  auctions,
  categoryRelations,
  categories,
  cartItems,
  carts,
  inventoryLedger,
  products,
  tenants,
  variants,
} from "@repo/db/schema";
import { INVENTORY_REASONS, slugify } from "@repo/shared";
import { and, eq, sum } from "drizzle-orm";
import { randomUUID } from "node:crypto";

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
      {
        slug: "minimalist-coffee-mug",
        title: "Minimalist Coffee Mug",
        description: "Hand-thrown ceramic mug with a comfortable handle.",
        variants: [{ sku: "MUG-001", price: "24.00", currency: "USD" }],
      },
      {
        slug: "wool-blanket",
        title: "Wool Blanket",
        description: "Warm wool blanket in neutral tones, perfect for cozy evenings.",
        variants: [{ sku: "BLK-001", price: "95.00", currency: "USD" }],
      },
      {
        slug: "brass-candle-holder",
        title: "Brass Candle Holder",
        description: "Elegant brass candle holder with geometric design.",
        variants: [
          {
            sku: "CH-001",
            price: "42.00",
            currency: "USD",
            auction: {
              startingBid: "25.00",
              minIncrement: "3.00",
              buyNowPrice: "55.00",
              durationMinutes: 150,
            },
          },
        ],
      },
      {
        slug: "linen-napkin-set",
        title: "Linen Napkin Set",
        description: "Set of 6 linen napkins in natural color.",
        variants: [{ sku: "NAP-001", price: "38.00", currency: "USD" }],
      },
      {
        slug: "wooden-cutting-board",
        title: "Wooden Cutting Board",
        description: "Bamboo cutting board with juice groove.",
        variants: [{ sku: "CUT-001", price: "52.00", currency: "USD" }],
      },
      {
        slug: "ceramic-bowl-set",
        title: "Ceramic Bowl Set",
        description: "Set of 4 hand-glazed ceramic bowls in various sizes.",
        variants: [
          {
            sku: "BOW-001",
            price: "68.00",
            currency: "USD",
            auction: {
              startingBid: "40.00",
              minIncrement: "4.00",
              buyNowPrice: "85.00",
              durationMinutes: 200,
            },
          },
        ],
      },
      {
        slug: "macrame-wall-hanging",
        title: "Macrame Wall Hanging",
        description: "Hand-knotted macrame wall art in natural fibers.",
        variants: [{ sku: "MAC-001", price: "75.00", currency: "USD" }],
      },
      {
        slug: "marble-coaster-set",
        title: "Marble Coaster Set",
        description: "Set of 4 marble coasters with cork backing.",
        variants: [{ sku: "COA-001", price: "32.00", currency: "USD" }],
      },
      {
        slug: "leather-keychain",
        title: "Leather Keychain",
        description: "Handcrafted leather keychain with brass hardware.",
        variants: [{ sku: "KEY-001", price: "18.00", currency: "USD" }],
      },
      {
        slug: "cotton-pillow-cover",
        title: "Cotton Pillow Cover",
        description: "Organic cotton pillow cover with geometric pattern.",
        variants: [
          {
            sku: "PIL-001",
            price: "45.00",
            currency: "USD",
            auction: {
              startingBid: "25.00",
              minIncrement: "2.50",
              buyNowPrice: "60.00",
              durationMinutes: 180,
            },
          },
        ],
      },
      {
        slug: "terracotta-pot",
        title: "Terracotta Pot",
        description: "Classic terracotta pot with drainage hole.",
        variants: [{ sku: "TER-001", price: "22.00", currency: "USD" }],
      },
      {
        slug: "bamboo-utensil-set",
        title: "Bamboo Utensil Set",
        description: "Set of 5 bamboo kitchen utensils.",
        variants: [{ sku: "UTL-001", price: "28.00", currency: "USD" }],
      },
      {
        slug: "woven-basket",
        title: "Woven Basket",
        description: "Handwoven storage basket in natural materials.",
        variants: [{ sku: "WOV-001", price: "48.00", currency: "USD" }],
      },
      {
        slug: "stone-salt-pepper-set",
        title: "Stone Salt & Pepper Set",
        description: "Natural stone salt and pepper shakers.",
        variants: [
          {
            sku: "STO-001",
            price: "35.00",
            currency: "USD",
            auction: {
              startingBid: "20.00",
              minIncrement: "2.00",
              buyNowPrice: "45.00",
              durationMinutes: 120,
            },
          },
        ],
      },
      {
        slug: "linen-tablecloth",
        title: "Linen Tablecloth",
        description: "Elegant linen tablecloth in natural color.",
        variants: [{ sku: "TAB-001", price: "78.00", currency: "USD" }],
      },
      {
        slug: "ceramic-vase-small",
        title: "Small Ceramic Vase",
        description: "Mini ceramic vase perfect for single stems.",
        variants: [{ sku: "VAS-001", price: "32.00", currency: "USD" }],
      },
      {
        slug: "wooden-spoon-set",
        title: "Wooden Spoon Set",
        description: "Set of 3 hand-carved wooden spoons.",
        variants: [{ sku: "SPO-001", price: "26.00", currency: "USD" }],
      },
      {
        slug: "cotton-dish-towels",
        title: "Cotton Dish Towels",
        description: "Set of 4 absorbent cotton dish towels.",
        variants: [{ sku: "TOW-001", price: "34.00", currency: "USD" }],
      },
      {
        slug: "brass-bookend-pair",
        title: "Brass Bookend Pair",
        description: "Heavy brass bookends with geometric design.",
        variants: [
          {
            sku: "BOO-001",
            price: "65.00",
            currency: "USD",
            auction: {
              startingBid: "35.00",
              minIncrement: "5.00",
              buyNowPrice: "80.00",
              durationMinutes: 240,
            },
          },
        ],
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

async function upsertTenant(shopSeed: ShopSeed) {
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shopSlug, shopSeed.slug));

  if (existing?.id) return existing.id;

  const [inserted] = await db
    .insert(tenants)
    .values({
      id: crypto.randomUUID(),
      shopSlug: shopSeed.slug,
      name: shopSeed.name,
      canSell: true,
    })
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

    // Add initial inventory stock with randomized availability states
    // 0 = sold out, 1-5 = low stock, 6-20 = in stock, 21-50 = plenty in stock
    const [existingStock] = await db
      .select({ total: sum(inventoryLedger.delta) })
      .from(inventoryLedger)
      .where(and(eq(inventoryLedger.tenantId, tenantId), eq(inventoryLedger.variantId, variantId)));

    // PostgreSQL sum() returns null when no rows, convert to 0
    const currentStock = existingStock?.total ? Number(existingStock.total) : 0;
    if (currentStock <= 0) {
      // Randomize stock to show different availability states:
      // 20% chance: sold out (0)
      // 20% chance: low stock (1-5)
      // 30% chance: in stock (6-20)
      // 30% chance: plenty in stock (21-50)
      const rand = Math.random();
      let initialStock: number;
      if (rand < 0.2) {
        initialStock = 0; // Sold out
      } else if (rand < 0.4) {
        initialStock = Math.floor(Math.random() * 5) + 1; // Low stock (1-5)
      } else if (rand < 0.7) {
        initialStock = Math.floor(Math.random() * 15) + 6; // In stock (6-20)
      } else {
        initialStock = Math.floor(Math.random() * 30) + 21; // Plenty (21-50)
      }

      console.log(
        `  Adding ${initialStock} units of stock for variant ${variantSeed.sku} (${variantId})`,
      );
      await db.insert(inventoryLedger).values({
        id: crypto.randomUUID(),
        tenantId,
        variantId,
        delta: initialStock,
        reason: INVENTORY_REASONS.INIT,
        refType: "SEED",
      });
    } else {
      console.log(
        `  Variant ${variantSeed.sku} already has ${currentStock} units in stock, skipping`,
      );
    }

    if (!("auction" in variantSeed) || !variantSeed.auction) continue;

    const auction = variantSeed.auction;
    // Start auction now (or very recently) so it's active
    const startsAt = new Date();
    // End auction in the future based on duration
    const endsAt = new Date(startsAt.getTime() + auction.durationMinutes * 60_000);

    // Delete existing auction for this variant if it exists, then insert new one
    await db.delete(auctions).where(eq(auctions.variantId, variantId));

    await db.insert(auctions).values({
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
    });
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

async function seed() {
  console.log("Starting seed...");

  await seedCategories();

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

    console.log(`✓ Seeded ${shopSeed.products.length} products for shop '${shopSeed.slug}'`);
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
