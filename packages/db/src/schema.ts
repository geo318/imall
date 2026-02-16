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
  canSell: boolean("can_sell").default(false).notNull(),
  canAuction: boolean("can_auction").default(false).notNull(),
  settings: text("settings_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Categories are global across tenants and support a multi-level tree.
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull().unique(),
    categoryKey: varchar("category_key", { length: 160 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    nameEn: varchar("name_en", { length: 256 }),
    nameKa: varchar("name_ka", { length: 256 }),
    nameRu: varchar("name_ru", { length: 256 }),
    icon: varchar("icon", { length: 32 }).default("📦").notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryKeyIdx: uniqueIndex("categories_category_key_unique").on(table.categoryKey),
  }),
);

// Category relations express parent-child links (many-to-many, depth via traversal).
export const categoryRelations = pgTable(
  "category_relations",
  {
    parentId: uuid("parent_id")
      .references(() => categories.id)
      .notNull(),
    childId: uuid("child_id")
      .references(() => categories.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.parentId, table.childId] }),
  }),
);

export const shopSettings = pgTable(
  "shop_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    bankDetails: text("bank_details"),
    payoutAccount: varchar("payout_account", { length: 128 }),
    payoutNotes: text("payout_notes"),
    orderNotes: text("order_notes"),
    inventoryNotes: text("inventory_notes"),
    sellerEmail: varchar("seller_email", { length: 256 }),
    sellerPhone: varchar("seller_phone", { length: 64 }),
    sellerRules: text("seller_rules"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantUniqueIdx: uniqueIndex("shop_settings_tenant_id_unique").on(table.tenantId),
  }),
);

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
    category: varchar("category", { length: 128 }).notNull(), // Product category (mandatory)
    imageUrls: text("image_urls"), // Comma-delimited string of image URLs
    status: varchar("status", { length: 32 }).default("active"),
    draft: boolean("draft").default(false).notNull(), // Draft status
    deletedAt: timestamp("deleted_at"), // Soft delete timestamp
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
    .references(() => products.id, { onDelete: "cascade" })
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
// tenantId is nullable to support a single cart that can hold items from multiple shops.
export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
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

// Payout schedules and ledger entries capture withdrawals, fees, and chargebacks.
export const payouts = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  status: varchar("status", { length: 32 }).default("scheduled").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  paidAt: timestamp("paid_at"),
  method: varchar("method", { length: 64 }),
  reference: varchar("reference", { length: 128 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const payoutLedger = pgTable("payout_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  payoutId: uuid("payout_id").references(() => payouts.id),
  type: varchar("type", { length: 32 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  referenceType: varchar("reference_type", { length: 64 }),
  referenceId: uuid("reference_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Returns and refunds track RMA flow and restock decisions.
export const returns = pgTable("returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  orderId: uuid("order_id").references(() => orders.id),
  status: varchar("status", { length: 32 }).default("requested").notNull(),
  reason: text("reason"),
  rmaNumber: varchar("rma_number", { length: 64 }),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }),
  refundCurrency: varchar("refund_currency", { length: 8 }).default("USD"),
  restockStatus: varchar("restock_status", { length: 32 }).default("pending").notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  receivedAt: timestamp("received_at"),
  refundedAt: timestamp("refunded_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const returnItems = pgTable("return_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  returnId: uuid("return_id")
    .references(() => returns.id)
    .notNull(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  variantId: uuid("variant_id").references(() => variants.id),
  qty: integer("qty").notNull(),
  restockQty: integer("restock_qty").default(0).notNull(),
  condition: varchar("condition", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shipping profiles and fulfillment rules define rates and routing.
export const shippingProfiles = pgTable("shipping_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  carrier: varchar("carrier", { length: 64 }),
  serviceLevel: varchar("service_level", { length: 64 }),
  rateType: varchar("rate_type", { length: 32 }).default("flat").notNull(),
  flatRate: numeric("flat_rate", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("USD"),
  minOrderValue: numeric("min_order_value", { precision: 12, scale: 2 }),
  maxOrderValue: numeric("max_order_value", { precision: 12, scale: 2 }),
  minWeight: numeric("min_weight", { precision: 12, scale: 2 }),
  maxWeight: numeric("max_weight", { precision: 12, scale: 2 }),
  estimatedMinDays: integer("estimated_min_days"),
  estimatedMaxDays: integer("estimated_max_days"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fulfillmentRules = pgTable("fulfillment_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  shippingProfileId: uuid("shipping_profile_id").references(() => shippingProfiles.id),
  priority: integer("priority").default(0).notNull(),
  destinationCountry: varchar("destination_country", { length: 2 }),
  minOrderValue: numeric("min_order_value", { precision: 12, scale: 2 }),
  maxOrderValue: numeric("max_order_value", { precision: 12, scale: 2 }),
  handlingDays: integer("handling_days"),
  active: boolean("active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Customer management includes segments and outbound messages.
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  email: varchar("email", { length: 256 }),
  name: varchar("name", { length: 256 }),
  phone: varchar("phone", { length: 32 }),
  status: varchar("status", { length: 32 }).default("active").notNull(),
  orderCount: integer("order_count").default(0).notNull(),
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 8 }).default("USD"),
  lastOrderAt: timestamp("last_order_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerSegments = pgTable("customer_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customerSegmentMembers = pgTable(
  "customer_segment_members",
  {
    segmentId: uuid("segment_id")
      .references(() => customerSegments.id)
      .notNull(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.segmentId, table.customerId] }),
  }),
);

export const customerMessages = pgTable("customer_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  customerId: uuid("customer_id")
    .references(() => customers.id)
    .notNull(),
  channel: varchar("channel", { length: 16 }).notNull(),
  subject: varchar("subject", { length: 256 }),
  body: text("body"),
  status: varchar("status", { length: 32 }).default("draft").notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Auctions table defines auctions tied to a variant. Only one unit is sold
// per auction in this simplified model. `currentPrice` caches the
// highest bid. `highestBidId` references the current highest bid.
// `highestBidderId` stores the Clerk user ID (externalAuthId) of the highest bidder for quick lookups.
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
  highestBidderId: varchar("highest_bidder_id", { length: 256 }), // Clerk user ID (externalAuthId)
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

// Product stats table tracks metrics for products (views, cart additions, etc.)
export const productStats = pgTable(
  "product_stats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    viewsTotal: integer("views_total").default(0).notNull(), // Total page views
    viewsUnique: integer("views_unique").default(0).notNull(), // Unique visitors
    addedToCart: integer("added_to_cart").default(0).notNull(), // Times added to cart
    loved: integer("loved").default(0).notNull(), // Times loved/favorited (<3)
    sold: integer("sold").default(0).notNull(), // Units sold
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: uniqueIndex("product_stats_product_id_unique").on(table.productId),
  }),
);

// Favorites table stores user's favorite products
export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdProductIdIdx: uniqueIndex("favorites_user_product_unique").on(
      table.userId,
      table.productId,
    ),
  }),
);
