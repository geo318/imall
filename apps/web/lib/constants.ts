/**
 * Cache tags for Next.js cache invalidation
 * Use these constants instead of magic strings
 */
export const CACHE_TAGS = {
  PRODUCTS: "products",
  PRODUCT: "product",
  CART: "cart",
  SHOPS: "shops",
  SHOP: "shop",
  AUCTIONS: "auctions",
  AUCTION: "auction",
  ORDERS: "orders",
  INVENTORY: "inventory",
} as const;

/**
 * Cache life durations for use with cacheLife()
 * Maps to cacheLife() duration strings
 */
export const CACHE_LIFE = {
  PRODUCTS: "minutes" as const, // 1 minute default
  PRODUCT: "seconds" as const, // 30 seconds default
  CART: "seconds" as const, // 10 seconds default
  SHOPS: "minutes" as const, // 5 minutes default
  SHOP: "minutes" as const, // 1 minute default
  AUCTIONS: "seconds" as const, // 30 seconds default
  STATIC: "hours" as const, // 1 hour for static content
} as const;

// Legacy exports for backward compatibility during migration
export const REVALIDATE_TAGS = CACHE_TAGS;
export const REVALIDATE_TIMES = {
  PRODUCTS: 60,
  PRODUCT: 30,
  CART: 10,
  SHOPS: 300,
  SHOP: 60,
  AUCTIONS: 30,
  STATIC: 3600,
} as const;
