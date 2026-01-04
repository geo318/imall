import {
  boolean,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Schema definitions for the multi‑tenant shop. Each table includes a
 * `tenant_id` field to scope data to a specific tenant. Composite
 * indexes should always begin with `tenant_id` to ensure fast query
 * performance on tenant‑scoped queries. These definitions are
 * intentionally verbose to make relationships explicit.
 */

// Tenants table stores high‑level information about each shop.
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopSlug: varchar("shop_slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  settings: text("settings_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users table stores application users. External auth IDs (e.g. from Clerk)
// map users to external providers. Email is optional because Clerk can
// supply it, but it is kept here for convenience.
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalAuthId: varchar("external_auth_id", { length: 256 }).notNull(),
  email: varchar("email", { length: 256 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Memberships table links users to tenants with a role. A user can belong
// to multiple tenants.
export const memberships = pgTable("memberships", {
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Products table contains high level product definitions. Each product
// belongs to a tenant. Use slugs on the product for friendly URLs.
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).default("active"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantSlugIdx: uniqueIndex("products_tenant_slug_unique").on(table.tenantId, table.slug),
  }),
);

// Variants table represents specific purchasable units of a product (e.g.
// sizes, colors). Each variant belongs to a product and tenant.
export const variants = pgTable(
  "variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    sku: varchar("sku", { length: 128 }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).default("USD").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productSkuIdx: uniqueIndex("variants_product_sku_unique").on(table.productId, table.sku),
  }),
);

// Product images link uploaded assets to products. Sorting is stored on
// the integer `sortOrder` field.
export const productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),
  assetId: uuid("asset_id").notNull(),
  sortOrder: integer("sort_order").default(0),
});

// Assets table stores metadata for uploaded files. The file contents are
// stored outside the database (e.g. in S3 or local filesystem). The
// storageKey uniquely identifies the location of the file in the
// underlying storage system.
export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  storageKey: varchar("storage_key", { length: 512 }).notNull(),
  mime: varchar("mime", { length: 128 }),
  size: integer("size"),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Inventory ledger records every change to a variant's stock. Stock on
// hand is computed by summing the `delta` values for a variant. See
// the reservations and sale flows in the README for usage.
export const inventoryLedger = pgTable("inventory_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  variantId: uuid("variant_id")
    .references(() => variants.id)
    .notNull(),
  delta: integer("delta").notNull(),
  reason: varchar("reason", { length: 32 }).notNull(),
  refType: varchar("ref_type", { length: 32 }),
  refId: uuid("ref_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Optional snapshot table caches available inventory counts for fast
// reads. Use a job to recompute snapshots or maintain via triggers.
export const inventorySnapshot = pgTable(
  "inventory_snapshot",
  {
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    variantId: uuid("variant_id")
      .references(() => variants.id)
      .notNull(),
    onHand: integer("on_hand").notNull(),
    reserved: integer("reserved").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.variantId] }),
  }),
);

// Carts hold items prior to checkout. A cart may be anonymous (no user)
// or associated with a user. Status transitions through open,
// checking_out and completed or expired.
export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  userId: uuid("user_id").references(() => users.id),
  status: varchar("status", { length: 32 }).default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cartItems = pgTable("cart_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  cartId: uuid("cart_id")
    .references(() => carts.id)
    .notNull(),
  variantId: uuid("variant_id")
    .references(() => variants.id)
    .notNull(),
  qty: integer("qty").notNull(),
});

// Orders represent completed purchases. Each order may include many
// order items. When an order is created from a cart or auction, the
// inventory ledger is updated accordingly.
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  userId: uuid("user_id").references(() => users.id),
  status: varchar("status", { length: 32 }).default("pending"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  orderId: uuid("order_id")
    .references(() => orders.id)
    .notNull(),
  variantId: uuid("variant_id")
    .references(() => variants.id)
    .notNull(),
  qty: integer("qty").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
});

// Auctions table defines auctions tied to a variant. Only one unit is sold
// per auction in this simplified model. `currentPrice` caches the
// highest bid. `highestBidId` references the current highest bid.
export const auctions = pgTable("auctions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  variantId: uuid("variant_id")
    .references(() => variants.id)
    .notNull(),
  status: varchar("status", { length: 32 }).default("scheduled"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  antiSnipeSeconds: integer("anti_snipe_seconds").default(0).notNull(),
  startingBid: numeric("starting_bid", { precision: 12, scale: 2 }).notNull(),
  minIncrement: numeric("min_increment", { precision: 12, scale: 2 }).notNull(),
  buyNowPrice: numeric("buy_now_price", { precision: 12, scale: 2 }),
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }),
  highestBidId: uuid("highest_bid_id"),
});

export const bids = pgTable("bids", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  auctionId: uuid("auction_id")
    .references(() => auctions.id)
    .notNull(),
  bidderId: uuid("bidder_id")
    .references(() => users.id)
    .notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
