/**
 * Shared constants for event names, status enums and other values.
 * Import these values across both the API and web applications to
 * ensure a single source of truth.
 */

/** Events published over WebSocket or message queues. */
export const EVENTS = {
  AUCTION_BID_PLACED: 'auction.bidPlaced',
  AUCTION_FINISHED: 'auction.finished',
  ORDER_CREATED: 'order.created',
} as const;

/** Allowed roles for a tenant membership. */
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  STAFF: 'staff',
  VIEWER: 'viewer',
} as const;

/** Reasons for inventory ledger entries. */
export const INVENTORY_REASONS = {
  INIT: 'INIT',
  ADJUSTMENT: 'ADJUSTMENT',
  RESERVE: 'RESERVE',
  RELEASE: 'RELEASE',
  SALE: 'SALE',
  RETURN: 'RETURN',
} as const;

/** Auction statuses. */
export const AUCTION_STATUS = {
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
} as const;