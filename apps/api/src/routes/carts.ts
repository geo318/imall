import {
  cartItems,
  carts,
  db,
  inventoryLedger,
  orderItems,
  orders,
  products,
  tenants,
  variants,
} from "@repo/db";
import { parseImageUrls } from "@repo/shared";
import { and, eq, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import {
  authPlugin,
  cartItemSchema,
  getAvailableStock,
  getAvailableStockMap,
  getVariantInventoryStatusMap,
  INVENTORY_REASONS,
  env,
} from "../context";
import {
  type CredoInstallmentProduct,
  createCredoInstallmentApplication,
  fetchCredoInstallmentStatus,
  validateOrderCodeForCart,
} from "../integrations/credo-installments";
import {
  KeepzApiError,
  KeepzConfigError,
  cancelKeepzOrder,
  createKeepzOrder,
  getKeepzConfigDiagnostics,
  getKeepzOrderStatus,
  isKeepzEcommerceConfigured,
  refundKeepzOrder,
} from "../integrations/keepz-ecommerce";
import { sanitizePersistedImageUrls } from "../utils/image-urls";
import { logger } from "../utils/logger";

const installmentStartSchema = z.object({
  provider: z.enum(["credo", "keepz"]).default("credo"),
  paymentType: z.enum(["card", "installments"]).default("installments"),
  installmentLength: z.coerce.number().int().positive().max(60).optional(),
  clientFullName: z.string().trim().max(128).optional(),
  mobile: z.string().trim().max(32).optional(),
  email: z.string().email().max(256).optional(),
  factAddress: z.string().trim().max(256).optional(),
  personalNumber: z.string().trim().max(32).optional(),
  isForeign: z.coerce.boolean().optional(),
});

const installmentStatusSchema = z.object({
  orderCode: z.string().trim().min(16).max(50),
  provider: z.enum(["credo", "keepz"]).optional(),
  paymentType: z.enum(["card", "installments"]).optional(),
});

const installmentCancelSchema = z.object({
  orderCode: z.string().trim().min(16).max(50),
  provider: z.enum(["credo", "keepz"]).optional(),
});

const installmentRefundSchema = z.object({
  orderCode: z.string().trim().min(16).max(50),
  provider: z.enum(["keepz"]).default("keepz"),
  amount: z.coerce.number().positive(),
});

const manualInstallmentCheckoutSchema = z.object({
  provider: z.enum(["crystal"]),
  comment: z.string().trim().max(2000).optional(),
});

type CheckoutResult = {
  orders: Array<{
    orderId: string;
    tenantId: string;
    total: number;
    currency: string;
  }>;
};

type CompleteCartCheckoutOptions = {
  paymentMethod?: string;
  manualSale?: boolean;
  manualSaleComment?: string | null;
  orderStatus?: string;
  installmentOrderCode?: string | null;
  installmentStatusId?: number | null;
  installmentStatusName?: string | null;
  installmentFlowStage?: string | null;
};

const CREDO_APPROVED_STATUS_IDS = new Set([3, 4, 12, 5]);
const CREDO_CANCELLED_STATUS_IDS = new Set([6, 7]);
const KEEPZ_SUCCESS_STATUSES = new Set(["SUCCESS"]);
const KEEPZ_CANCELLED_STATUSES = new Set(["FAILED", "CANCELED", "EXPIRED"]);
const KEEPZ_DESERIALIZE_ERROR_PATTERN = /(can'?t|cannot)\s+deserialize\s+object/i;
const KEEPZ_DEFAULT_MIN_ORDER_AMOUNT = 1.1;
const KEEPZ_DEFAULT_MAX_ORDER_AMOUNT = 3000;

function toInstallmentFlowStage(statusId: number | null, fallback: string | null): string | null {
  if (statusId === 5) return "completed";
  if (statusId === 12) return "pending";
  if (statusId === 3 || statusId === 4) return "approved";
  if (statusId === 6) return "rejected";
  if (statusId === 7) return "cancelled";
  return fallback;
}

function toKeepzFlowStage(status: string, fallback: string | null): string | null {
  if (status === "SUCCESS") return "completed";
  if (status === "PROCESSING") return "pending";
  if (status === "INITIAL") return "approved";
  if (status === "CANCELED") return "cancelled";
  if (status === "EXPIRED") return "expired";
  if (status === "FAILED") return "failed";
  if (status === "REFUND_REQUESTED") return "refund_requested";
  if (status === "PARTIALLY_REFUNDED") return "partially_refunded";
  if (
    status === "REFUNDED_BY_OPERATOR" ||
    status === "REFUNDED_BY_INTEGRATOR" ||
    status === "REFUNDED_BY_KEEPZ"
  ) {
    return "refunded";
  }
  if (status === "REFUNDED_FAILED") return "refund_failed";
  return fallback;
}

function sanitizeKeepzErrorRaw(raw: unknown): unknown {
  if (typeof raw === "string") {
    return raw.length > 800 ? `${raw.slice(0, 800)}…` : raw;
  }

  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const record = raw as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "encryptedData" || key === "encryptedKeys") {
      const length = typeof value === "string" ? value.length : null;
      sanitized[key] = `<redacted length=${length ?? "n/a"}>`;
      continue;
    }
    if (typeof value === "string" && value.length > 800) {
      sanitized[key] = `${value.slice(0, 800)}…`;
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

function trimTrailingZeros(amount: number): string {
  if (!Number.isFinite(amount)) return String(amount);
  return amount.toFixed(2).replace(/\.?0+$/, "");
}

function getKeepzOrderAmountLimits(): { minAmount: number; maxAmount: number; misconfigured: boolean } {
  const configuredMin = env.KEEPZ_MIN_ORDER_AMOUNT ?? KEEPZ_DEFAULT_MIN_ORDER_AMOUNT;
  const configuredMax = env.KEEPZ_MAX_ORDER_AMOUNT ?? KEEPZ_DEFAULT_MAX_ORDER_AMOUNT;
  return {
    minAmount: Math.min(configuredMin, configuredMax),
    maxAmount: Math.max(configuredMin, configuredMax),
    misconfigured: configuredMin > configuredMax,
  };
}

function normalizeKeepzErrorMessage(error: KeepzApiError): string {
  const normalized = error.message.trim();
  if (KEEPZ_DESERIALIZE_ERROR_PATTERN.test(normalized)) {
    return "Keepz rejected encrypted payload. Check KEEPZ/CREDO RSA keys and merchant credentials.";
  }
  if (error.keepzStatusCode === 6026) {
    const { minAmount, maxAmount } = getKeepzOrderAmountLimits();
    return `Keepz amount must be in range ${trimTrailingZeros(minAmount)}-${trimTrailingZeros(maxAmount)} GEL.`;
  }
  if (!normalized) {
    return "Keepz request failed";
  }
  return normalized;
}

function buildKeepzErrorResponse(error: KeepzApiError): Record<string, unknown> {
  const response: Record<string, unknown> = {
    error: normalizeKeepzErrorMessage(error),
    statusCode: error.keepzStatusCode,
    exceptionGroup: error.exceptionGroup,
  };

  if (env.NODE_ENV === "development") {
    response.message = error.message;
    response.debug = sanitizeKeepzErrorRaw(error.raw);
  }

  return response;
}

function buildKeepzNotConfiguredResponse() {
  const response: Record<string, unknown> = {
    error: "Keepz integration is not configured",
    code: "KEEPZ_NOT_CONFIGURED",
  };
  if (env.NODE_ENV === "development") {
    response.debug = getKeepzConfigDiagnostics();
  }
  return response;
}

function buildKeepzConfigErrorResponse(error: KeepzConfigError): Record<string, unknown> {
  const response: Record<string, unknown> = {
    error: error.message,
    code: "KEEPZ_NOT_CONFIGURED",
  };
  if (env.NODE_ENV === "development") {
    response.debug = error.details;
  }
  return response;
}

function logKeepzApiError(
  action: "start" | "status" | "cancel" | "refund",
  context: Record<string, unknown>,
  error: KeepzApiError,
) {
  logger.error(`[Cart Route] Keepz ${action} failed`, {
    ...context,
    httpStatus: error.httpStatus,
    keepzMessage: error.message,
    statusCode: error.keepzStatusCode,
    exceptionGroup: error.exceptionGroup,
    raw: sanitizeKeepzErrorRaw(error.raw),
  });
}

function logKeepzConfigError(
  action: "start" | "status" | "cancel" | "refund",
  context: Record<string, unknown>,
  error: KeepzConfigError,
) {
  logger.error(`[Cart Route] Keepz ${action} config error`, {
    ...context,
    message: error.message,
    details: error.details,
  });
}

function inferStatusProvider(
  payload: z.infer<typeof installmentStatusSchema>,
  cartId: string,
): "credo" | "keepz" {
  if (payload.provider) {
    return payload.provider;
  }

  return validateOrderCodeForCart(payload.orderCode, cartId) ? "credo" : "keepz";
}

export async function completeCartCheckout(
  cartId: string,
  authUserId: string | null,
  options: CompleteCartCheckoutOptions = {},
): Promise<CheckoutResult> {
  return db.transaction(async (tx) => {
    // Lock the cart row for the transaction's duration. Concurrent checkout
    // calls block here; when they resume they see status "completed" and
    // throw 409 — preventing double orders without extra idempotency logic.
    const [cart] = await tx
      .select({ id: carts.id, status: carts.status, userId: carts.userId })
      .from(carts)
      .where(eq(carts.id, cartId))
      .for("update");

    if (!cart) {
      throw new Response("Cart not found", { status: 404 });
    }

    const cartUserId = cart.userId;
    if (cartUserId && authUserId !== cartUserId) {
      throw new Response("Forbidden: You don't have access to this cart", { status: 403 });
    }

    if (cart.status !== "open") {
      throw new Response("Cart is not open", { status: 409 });
    }

    // Fetch items (cart row already locked above)
    const itemRows = await tx
      .select({
        variantId: cartItems.variantId,
        tenantId: cartItems.tenantId,
        qty: cartItems.qty,
        price: variants.price,
        currency: variants.currency,
        productId: variants.productId,
      })
      .from(cartItems)
      .innerJoin(variants, eq(cartItems.variantId, variants.id))
      .where(eq(cartItems.cartId, cartId));

    const items = itemRows.filter(
      (
        row,
      ): row is (typeof itemRows)[number] & {
        variantId: string;
        tenantId: string;
        qty: number;
        price: string;
      } => Boolean(row.variantId && row.tenantId && row.qty !== null && row.price !== null),
    );
    if (items.length === 0) {
      throw new Response("Cart is empty", { status: 400 });
    }

    // Check stock for each item (using batched lookups per tenant)
    const variantIdsByTenant = new Map<string, Set<string>>();
    for (const item of items) {
      if (!item.variantId || !item.tenantId) continue;
      const tenantVariants = variantIdsByTenant.get(item.tenantId) ?? new Set<string>();
      tenantVariants.add(item.variantId);
      variantIdsByTenant.set(item.tenantId, tenantVariants);
    }

    const stockByTenant = new Map<string, Map<string, number>>();
    await Promise.all(
      Array.from(variantIdsByTenant.entries()).map(async ([tenantId, variantIds]) => {
        stockByTenant.set(tenantId, await getAvailableStockMap(tenantId, Array.from(variantIds)));
      }),
    );

    for (const item of items) {
      const available = stockByTenant.get(item.tenantId)?.get(item.variantId) ?? 0;
      if (available < (item.qty ?? 0)) {
        throw new Response("Insufficient stock", { status: 409 });
      }
    }

    // Group items by tenant for creating separate orders
    const itemsByTenant = new Map<string, typeof items>();
    for (const item of items) {
      const tenantItems = itemsByTenant.get(item.tenantId) ?? [];
      tenantItems.push(item);
      itemsByTenant.set(item.tenantId, tenantItems);
    }

    // Create orders for each tenant
    const createdOrders = [];
    for (const [tenantId, tenantItems] of itemsByTenant.entries()) {
      const currency = tenantItems[0]?.currency ?? "USD";
      const total = tenantItems.reduce((sum, item) => {
        const priceNumber = Number(item.price ?? 0);
        return sum + priceNumber * (item.qty ?? 0);
      }, 0);

      const [order] = await tx
        .insert(orders)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          userId: cartUserId ?? authUserId ?? null,
          status: options.orderStatus ?? "pending",
          paymentMethod: options.paymentMethod ?? "card",
          manualSale: options.manualSale ?? false,
          manualSaleComment: options.manualSaleComment?.trim() || null,
          installmentOrderCode: options.installmentOrderCode?.trim() || null,
          installmentStatusId: options.installmentStatusId ?? null,
          installmentStatusName: options.installmentStatusName ?? null,
          installmentFlowStage: options.installmentFlowStage ?? null,
          total: String(total),
          currency,
        })
        .returning({ id: orders.id });
      if (!order) {
        throw new Response("Order creation failed", { status: 500 });
      }

      await tx.insert(orderItems).values(
        tenantItems.map((item) => ({
          id: crypto.randomUUID(),
          tenantId,
          orderId: order.id,
          variantId: item.variantId,
          qty: item.qty,
          unitPrice: item.price,
        })),
      );
      await tx.insert(inventoryLedger).values(
        tenantItems.map((item) => ({
          id: crypto.randomUUID(),
          tenantId,
          variantId: item.variantId,
          delta: -Math.abs(item.qty),
          reason: INVENTORY_REASONS.SALE,
          refType: "order",
          refId: order.id,
        })),
      );

      createdOrders.push({ orderId: order.id, tenantId, total, currency });
    }

    // Mark cart as completed
    await tx
      .update(carts)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(carts.id, cartId));

    return { orders: createdOrders };
  });
}

// Cart routes - single cart that can hold items from multiple shops
export const cartRoutes = new Elysia({ prefix: "/carts" })
  .use(authPlugin)
  .get("/", async () => {
    return { status: "ok", message: "Cart routes are working" };
  })
  .post("/", async ({ auth, set }) => {
    try {
      // Use userId from verified Clerk auth token, not from request body
      const userId = auth?.userId;

      // Create cart (single cart across shops). tenantId is nullable by design.
      const [inserted] = await db
        .insert(carts)
        .values({
          id: crypto.randomUUID(),
          // Use SQL NULL to satisfy current generated types until db package is rebuilt.
          tenantId: sql`NULL`,
          userId,
        })
        .returning({ id: carts.id });
      set.status = 201;
      return { id: inserted?.id, status: "open" };
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("[Cart Route] Failed to create cart");
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to create cart",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .get("/:cartId", async ({ params, auth, set }) => {
    const { cartId } = params as { cartId: string };
    try {
      // Get cart (do not scope by tenant; items can be from multiple tenants)
      const [cart] = await db
        .select({
          id: carts.id,
          status: carts.status,
          tenantId: carts.tenantId,
          userId: carts.userId,
          createdAt: carts.createdAt,
          updatedAt: carts.updatedAt,
        })
        .from(carts)
        .where(eq(carts.id, cartId))
        .limit(1);
      if (!cart || cart.status !== "open") {
        set.status = 404;
        return { error: "Cart not found" };
      }

      // Authorization: If cart has a userId, ensure the authenticated user matches
      // Guest carts (userId === null) are accessible to anyone with the cartId
      if (cart.userId && auth?.userId !== cart.userId) {
        set.status = 403;
        return { error: "Forbidden: You don't have access to this cart" };
      }

      // Get all items from this cart (items can be from different tenants)
      const items = await db
        .select({
          id: cartItems.id,
          qty: cartItems.qty,
          variantId: cartItems.variantId,
          tenantId: cartItems.tenantId, // Each item has its own tenant
          sku: variants.sku,
          trackInventory: variants.trackInventory,
          price: variants.price,
          currency: variants.currency,
          productId: products.id,
          productTitle: products.title,
          productSlug: products.slug,
          productImageUrls: products.imageUrls,
        })
        .from(cartItems)
        .innerJoin(variants, eq(cartItems.variantId, variants.id))
        .innerJoin(products, eq(variants.productId, products.id))
        .where(eq(cartItems.cartId, cartId));

      const variantIdsByTenant = new Map<string, Set<string>>();
      for (const item of items) {
        const tenantVariants = variantIdsByTenant.get(item.tenantId) ?? new Set<string>();
        tenantVariants.add(item.variantId);
        variantIdsByTenant.set(item.tenantId, tenantVariants);
      }

      const stockByTenant = new Map<
        string,
        Map<string, { trackInventory: boolean; available: number }>
      >();
      await Promise.all(
        Array.from(variantIdsByTenant.entries()).map(async ([tenantId, variantIds]) => {
          const stockMap = await getVariantInventoryStatusMap(tenantId, Array.from(variantIds));
          stockByTenant.set(tenantId, stockMap);
        }),
      );

      // Attach availability and parse image URLs for each item
      const itemsWithAvailability = items.map((item) => {
        const inventory = stockByTenant.get(item.tenantId)?.get(item.variantId);
        const availableQty = inventory?.trackInventory ? inventory.available : undefined;

        // Parse image URLs from comma-delimited string
        const productImageUrl =
          sanitizePersistedImageUrls(parseImageUrls(item.productImageUrls))[0] ?? null;

        return {
          ...item,
          availableQty,
          productImageUrl,
        };
      });

      return { id: cart.id, status: cart.status, items: itemsWithAvailability };
    } catch (err) {
      if (err instanceof Response) {
        set.status = err.status;
        return { error: err.statusText || "Not found" };
      }
      console.error("[Cart Route] Failed to load cart:", cartId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to load cart",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .post("/:cartId/items", async ({ params, body, auth, set }) => {
    const { cartId } = params as { cartId: string };
    let payload: unknown;
    try {
      payload = cartItemSchema.parse(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid item payload";
      return new Response(message, { status: 400 });
    }
    const { variantId, qty } = payload as z.infer<typeof cartItemSchema>;

    try {
      const result = await db.transaction(async (tx) => {
        // Get variant to determine its tenantId
        const [variant] = await tx
          .select({ id: variants.id, tenantId: variants.tenantId })
          .from(variants)
          .where(eq(variants.id, variantId))
          .limit(1);
        if (!variant) {
          throw new Response("Variant not found", { status: 404 });
        }

        // Verify cart exists and user has access
        const [cart] = await tx
          .select({ id: carts.id, userId: carts.userId, status: carts.status })
          .from(carts)
          .where(eq(carts.id, cartId))
          .limit(1);
        if (!cart) {
          throw new Response("Cart not found", { status: 404 });
        }
        if (cart.status !== "open") {
          throw new Response("Cart is not open", { status: 409 });
        }
        // Authorization: If cart has a userId, ensure the authenticated user matches
        if (cart.userId && auth?.userId !== cart.userId) {
          throw new Response("Forbidden: You don't have access to this cart", {
            status: 403,
          });
        }

        // Check if item already exists in cart
        const [existing] = await tx
          .select({ id: cartItems.id, qty: cartItems.qty })
          .from(cartItems)
          .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
          .limit(1);

        let itemId: string;
        let newQty: number;
        if (existing) {
          newQty = existing.qty + qty;
          const available = await getAvailableStock(variant.tenantId, variantId);
          if (available < newQty) {
            throw new Error(`INSUFFICIENT_STOCK:${available}`);
          }
          await tx.update(cartItems).set({ qty: newQty }).where(eq(cartItems.id, existing.id));
          itemId = existing.id;
        } else {
          itemId = crypto.randomUUID();
          newQty = qty;
          const available = await getAvailableStock(variant.tenantId, variantId);
          if (available < newQty) {
            throw new Error(`INSUFFICIENT_STOCK:${available}`);
          }
          await tx.insert(cartItems).values({
            id: itemId,
            tenantId: variant.tenantId, // Item's tenant comes from variant
            cartId,
            variantId,
            qty: newQty,
          });
        }

        await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));

        return { itemId, qty: newQty };
      });

      return { cartId, itemId: result.itemId, qty: result.qty };
    } catch (err) {
      if (err instanceof Response) return err;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.startsWith("INSUFFICIENT_STOCK:")) {
        const available = Number(errMsg.split(":")[1]);
        set.status = 409;
        return {
          error: "Insufficient stock",
          message: `Only ${available} available`,
        };
      }
      console.error("[Cart Route] Failed to add item to cart:", cartId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to add to cart",
        message: errMsg,
      };
    }
  })
  .patch("/:cartId/items/:itemId", async ({ params, body, auth, set }) => {
    const { cartId, itemId } = params as { cartId: string; itemId: string };
    const updateSchema = z.object({
      qty: z.coerce.number().int(),
    });

    let payload: z.infer<typeof updateSchema>;
    try {
      payload = updateSchema.parse(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid payload";
      return new Response(message, { status: 400 });
    }

    const qty = payload.qty;

    try {
      const result = await db.transaction(async (tx) => {
        // Verify item belongs to cart and user has access
        const [item] = await tx
          .select({
            id: cartItems.id,
            qty: cartItems.qty,
            tenantId: cartItems.tenantId,
            variantId: cartItems.variantId,
            cartUserId: carts.userId,
            cartStatus: carts.status,
          })
          .from(cartItems)
          .innerJoin(carts, eq(cartItems.cartId, carts.id))
          .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
          .limit(1);

        if (!item) {
          throw new Response("Cart item not found", { status: 404 });
        }
        if (item.cartStatus !== "open") {
          throw new Response("Cart is not open", { status: 409 });
        }

        // Authorization: If cart has a userId, ensure the authenticated user matches
        if (item.cartUserId && auth?.userId !== item.cartUserId) {
          throw new Response("Forbidden: You don't have access to this cart", {
            status: 403,
          });
        }

        if (qty <= 0) {
          await tx.delete(cartItems).where(eq(cartItems.id, itemId));
          await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
          return { removed: true, itemId };
        }

        const available = await getAvailableStock(item.tenantId, item.variantId);
        if (available < qty) {
          throw new Error(`INSUFFICIENT_STOCK:${available}`);
        }

        await tx.update(cartItems).set({ qty }).where(eq(cartItems.id, itemId));
        await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
        return { removed: false, itemId, qty };
      });

      return result;
    } catch (err) {
      if (err instanceof Response) return err;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.startsWith("INSUFFICIENT_STOCK:")) {
        const available = Number(errMsg.split(":")[1]);
        set.status = 409;
        return {
          error: "Insufficient stock",
          message: `Only ${available} available`,
        };
      }
      console.error("[Cart Route] Failed to update cart item:", cartId, itemId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to update cart item",
        message: errMsg,
      };
    }
  })
  .delete("/:cartId/items/:itemId", async ({ params, auth, set }) => {
    const { cartId, itemId } = params as { cartId: string; itemId: string };

    try {
      await db.transaction(async (tx) => {
        const [item] = await tx
          .select({ id: cartItems.id, cartUserId: carts.userId, cartStatus: carts.status })
          .from(cartItems)
          .innerJoin(carts, eq(cartItems.cartId, carts.id))
          .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
          .limit(1);
        if (!item) {
          throw new Response("Cart item not found", { status: 404 });
        }
        if (item.cartStatus !== "open") {
          throw new Response("Cart is not open", { status: 409 });
        }

        // Authorization: If cart has a userId, ensure the authenticated user matches
        if (item.cartUserId && auth?.userId !== item.cartUserId) {
          throw new Response("Forbidden: You don't have access to this cart", {
            status: 403,
          });
        }

        await tx.delete(cartItems).where(eq(cartItems.id, itemId));
        await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
      });

      set.status = 204;
      return;
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("[Cart Route] Failed to remove cart item:", cartId, itemId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to remove cart item",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .post("/:cartId/checkout", async ({ params, auth, set }) => {
    const { cartId } = params as { cartId: string };

    try {
      const result = await completeCartCheckout(cartId, auth?.userId ?? null, {
        paymentMethod: "card",
      });

      set.status = 201;
      return result;
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("[Cart Route] Failed to checkout cart:", cartId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Checkout failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .post("/:cartId/checkout/installments/start", async ({ params, body, auth, set }) => {
    const { cartId } = params as { cartId: string };

    let payload: z.infer<typeof installmentStartSchema>;
    try {
      payload = installmentStartSchema.parse(body);
    } catch (error) {
      set.status = 400;
      return {
        error: "Invalid installment payload",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const rows = await db
        .select({
          cartId: carts.id,
          status: carts.status,
          userId: carts.userId,
          variantId: cartItems.variantId,
          tenantId: cartItems.tenantId,
          qty: cartItems.qty,
          price: variants.price,
          productId: products.id,
          productTitle: products.title,
        })
        .from(carts)
        .leftJoin(cartItems, eq(cartItems.cartId, carts.id))
        .leftJoin(variants, eq(cartItems.variantId, variants.id))
        .leftJoin(products, eq(variants.productId, products.id))
        .where(eq(carts.id, cartId));

      if (rows.length === 0) {
        set.status = 404;
        return { error: "Cart not found" };
      }

      const cartUserId = rows[0]?.userId;
      if (cartUserId && auth?.userId !== cartUserId) {
        set.status = 403;
        return { error: "Forbidden: You don't have access to this cart" };
      }

      if (rows[0]?.status !== "open") {
        set.status = 409;
        return { error: "Cart is not open" };
      }

      const checkoutItems = rows.filter(
        (
          row,
        ): row is (typeof rows)[number] & {
          variantId: string;
          tenantId: string;
          qty: number;
          price: string;
          productId: string;
          productTitle: string;
        } =>
          Boolean(
            row.variantId &&
              row.tenantId &&
              row.qty !== null &&
              row.price !== null &&
              row.productId &&
              row.productTitle,
          ),
      );

      if (checkoutItems.length === 0) {
        set.status = 400;
        return { error: "Cart is empty" };
      }

      const distinctTenantIds = new Set(checkoutItems.map((item) => item.tenantId));
      if (distinctTenantIds.size > 1) {
        set.status = 409;
        return {
          error: "Online installments are available only for single-vendor carts",
          code: "INSTALLMENTS_SINGLE_VENDOR_REQUIRED",
        };
      }

      const firstCartItem = checkoutItems[0];
      if (!firstCartItem) {
        set.status = 400;
        return { error: "Cart is empty" };
      }

      // Reuse stock checks from standard checkout to avoid sending impossible applications.
      const variantIdsByTenant = new Map<string, Set<string>>();
      for (const item of checkoutItems) {
        const tenantVariants = variantIdsByTenant.get(item.tenantId) ?? new Set<string>();
        tenantVariants.add(item.variantId);
        variantIdsByTenant.set(item.tenantId, tenantVariants);
      }

      const stockByTenant = new Map<string, Map<string, number>>();
      await Promise.all(
        Array.from(variantIdsByTenant.entries()).map(async ([tenantId, variantIds]) => {
          stockByTenant.set(tenantId, await getAvailableStockMap(tenantId, Array.from(variantIds)));
        }),
      );

      for (const item of checkoutItems) {
        const available = stockByTenant.get(item.tenantId)?.get(item.variantId) ?? 0;
        if (available < item.qty) {
          set.status = 409;
          return {
            error: "Insufficient stock",
            message: `${item.productTitle} has only ${available} available`,
          };
        }
      }

      const subtotal = checkoutItems.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);

      if (payload.provider === "keepz") {
        if (!isKeepzEcommerceConfigured()) {
          set.status = 503;
          return buildKeepzNotConfiguredResponse();
        }

        const callbackUri = (() => {
          const configured = env.KEEPZ_CALLBACK_URL?.trim();
          if (configured) {
            try {
              const url = new URL(configured);
              url.searchParams.set("cartId", cartId);
              url.searchParams.set("paymentType", payload.paymentType);
              return url.toString();
            } catch {
              return configured;
            }
          }

          try {
            const fallback = new URL("/api/payments/keepz/callback", env.BACKEND_URL);
            fallback.searchParams.set("cartId", cartId);
            fallback.searchParams.set("paymentType", payload.paymentType);
            return fallback.toString();
          } catch {
            return undefined;
          }
        })();

        const commission = payload.paymentType === "installments" ? subtotal * 0.12 : 0;
        const amount = Number((subtotal + commission).toFixed(2));
        const { minAmount, maxAmount, misconfigured } = getKeepzOrderAmountLimits();
        if (misconfigured) {
          logger.warn("[Cart Route] Keepz amount range env is inverted; using normalized bounds", {
            configuredMin: env.KEEPZ_MIN_ORDER_AMOUNT,
            configuredMax: env.KEEPZ_MAX_ORDER_AMOUNT,
            normalizedMin: minAmount,
            normalizedMax: maxAmount,
          });
        }
        if (amount < minAmount || amount > maxAmount) {
          logger.warn("[Cart Route] Keepz start blocked by amount range", {
            cartId,
            paymentType: payload.paymentType,
            amount,
            minAmount,
            maxAmount,
            subtotal: Number(subtotal.toFixed(2)),
            commission: Number(commission.toFixed(2)),
          });
          set.status = 400;
          return {
            error: `Keepz amount must be in range ${trimTrailingZeros(minAmount)}-${trimTrailingZeros(maxAmount)} GEL.`,
            code: "KEEPZ_AMOUNT_OUT_OF_RANGE",
            amount,
            minAmount,
            maxAmount,
          };
        }
        const keepzSession = await createKeepzOrder({
          amount,
          integratorOrderId: crypto.randomUUID(),
          type: payload.paymentType,
          callbackUri,
          personalNumber: payload.personalNumber,
          isForeign: payload.isForeign,
        });

        logger.info("[Cart Route] Created Keepz checkout session", {
          cartId,
          paymentType: payload.paymentType,
          orderCode: keepzSession.integratorOrderId,
          redirectUrl: keepzSession.redirectUrl,
        });

        return {
          orderCode: keepzSession.integratorOrderId,
          redirectUrl: keepzSession.redirectUrl,
          provider: "keepz",
          paymentType: payload.paymentType,
        };
      }

      const mediatorTenantId = firstCartItem.tenantId;
      const [mediatorShop] = await db
        .select({
          shopId: tenants.id,
          shopSlug: tenants.shopSlug,
          shopName: tenants.name,
        })
        .from(tenants)
        .where(eq(tenants.id, mediatorTenantId))
        .limit(1);
      const mediatorShopNumberMatch = mediatorShop?.shopSlug?.match(/\d+/);
      const mediatorShopNumber = mediatorShopNumberMatch?.[0];
      const credoMeta = {
        mediatorShopName: mediatorShop?.shopName ?? "",
        mediatorShopNumber: mediatorShopNumber ?? "",
        mediatorShopId: mediatorShop?.shopId ?? mediatorTenantId,
      };

      const credoProducts: CredoInstallmentProduct[] = checkoutItems.map((item) => {
        const unitPrice = Number(item.price);
        return {
          id: item.variantId,
          title: item.productTitle,
          amount: item.qty,
          price: Math.max(1, Math.round(unitPrice * 100)),
          type: 0,
        };
      });

      // 12% commission is charged only for installments and must be included in Credo payload.
      const commissionTetri = Math.round(subtotal * 0.12 * 100);
      if (commissionTetri > 0) {
        credoProducts.push({
          id: `fee-${cartId.slice(0, 8)}`,
          title: "Installment commission",
          amount: 1,
          price: commissionTetri,
          type: 0,
        });
      }

      const session = await createCredoInstallmentApplication({
        cartId,
        products: credoProducts,
        installmentLength: payload.installmentLength,
        clientFullName: payload.clientFullName,
        mobile: payload.mobile,
        email: payload.email,
        factAddress: payload.factAddress,
        meta: credoMeta,
      });

      logger.info("[Cart Route] Credo installment payload summary", {
        cartId,
        productsCount: credoProducts.length,
        hasClientFullName: Boolean(payload.clientFullName?.trim()),
        hasMobile: Boolean(payload.mobile?.trim()),
        hasEmail: Boolean(payload.email?.trim()),
        hasFactAddress: Boolean(payload.factAddress?.trim()),
      });

      logger.info("[Cart Route] Created Credo installment session", {
        cartId,
        orderCode: session.orderCode,
        redirectUrl: session.redirectUrl,
        redirectHost: (() => {
          try {
            return new URL(session.redirectUrl).hostname;
          } catch {
            return "invalid";
          }
        })(),
      });

      return {
        orderCode: session.orderCode,
        redirectUrl: session.redirectUrl,
        provider: "credo",
        paymentType: "installments",
      };
    } catch (error) {
      if (error instanceof KeepzConfigError) {
        logKeepzConfigError(
          "start",
          {
            cartId,
            paymentType: payload.paymentType,
            provider: payload.provider,
          },
          error,
        );
        set.status = 503;
        return buildKeepzConfigErrorResponse(error);
      }
      if (error instanceof KeepzApiError) {
        logKeepzApiError(
          "start",
          {
            cartId,
            paymentType: payload.paymentType,
            provider: payload.provider,
          },
          error,
        );
        set.status = error.httpStatus || 502;
        return buildKeepzErrorResponse(error);
      }
      logger.error("[Cart Route] Failed to start installment checkout", {
        cartId,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return {
        error: "Failed to start installment checkout",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  })
  .post("/:cartId/checkout/installments/manual", async ({ params, body, auth, set }) => {
    const { cartId } = params as { cartId: string };

    let payload: z.infer<typeof manualInstallmentCheckoutSchema>;
    try {
      payload = manualInstallmentCheckoutSchema.parse(body);
    } catch (error) {
      set.status = 400;
      return {
        error: "Invalid manual installment payload",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const [cart] = await db
        .select({ id: carts.id, status: carts.status, userId: carts.userId })
        .from(carts)
        .where(eq(carts.id, cartId))
        .limit(1);

      if (!cart) {
        set.status = 404;
        return { error: "Cart not found" };
      }

      if (cart.userId && auth?.userId !== cart.userId) {
        set.status = 403;
        return { error: "Forbidden: You don't have access to this cart" };
      }

      if (cart.status !== "open") {
        set.status = 409;
        return { error: "Cart is not open" };
      }

      const checkoutResult = await completeCartCheckout(cartId, auth?.userId ?? null, {
        paymentMethod: `installments_${payload.provider}`,
        manualSale: true,
        manualSaleComment: payload.comment?.trim() || null,
      });

      return {
        checkoutCompleted: true,
        orders: checkoutResult.orders,
      };
    } catch (error) {
      logger.error("[Cart Route] Failed to register manual installment sale", {
        cartId,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return {
        error: "Failed to register manual installment sale",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  })
  .post("/:cartId/checkout/installments/cancel", async ({ params, body, auth, set }) => {
    const { cartId } = params as { cartId: string };

    let payload: z.infer<typeof installmentCancelSchema>;
    try {
      payload = installmentCancelSchema.parse(body);
    } catch (error) {
      set.status = 400;
      return {
        error: "Invalid cancellation payload",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const [cart] = await db
        .select({ id: carts.id, userId: carts.userId })
        .from(carts)
        .where(eq(carts.id, cartId))
        .limit(1);

      if (!cart) {
        set.status = 404;
        return { error: "Cart not found" };
      }

      if (cart.userId && auth?.userId !== cart.userId) {
        set.status = 403;
        return { error: "Forbidden: You don't have access to this cart" };
      }

      const provider =
        payload.provider ?? (validateOrderCodeForCart(payload.orderCode, cartId) ? "credo" : "keepz");
      if (provider !== "keepz") {
        set.status = 400;
        return { error: "Cancellation is supported only for Keepz orders" };
      }

      if (!isKeepzEcommerceConfigured()) {
        set.status = 503;
        return buildKeepzNotConfiguredResponse();
      }

      const cancellation = await cancelKeepzOrder(payload.orderCode);
      const normalizedStatus = cancellation.status.toUpperCase();
      const [existingOrder] = await db
        .select({ id: orders.id, status: orders.status, installmentFlowStage: orders.installmentFlowStage })
        .from(orders)
        .where(eq(orders.installmentOrderCode, payload.orderCode))
        .limit(1);

      if (existingOrder) {
        const orderPatch: Partial<typeof orders.$inferInsert> = {
          installmentStatusId: null,
          installmentStatusName: normalizedStatus,
          installmentFlowStage: toKeepzFlowStage(normalizedStatus, existingOrder.installmentFlowStage),
        };
        if (KEEPZ_CANCELLED_STATUSES.has(normalizedStatus) && existingOrder.status !== "completed") {
          orderPatch.status = "cancelled";
        }
        await db.update(orders).set(orderPatch).where(eq(orders.id, existingOrder.id));
      }

      return {
        orderCode: payload.orderCode,
        statusName: normalizedStatus,
        statusProvider: "keepz",
        raw: cancellation.raw,
      };
    } catch (error) {
      if (error instanceof KeepzConfigError) {
        logKeepzConfigError(
          "cancel",
          {
            cartId,
            orderCode: payload.orderCode,
          },
          error,
        );
        set.status = 503;
        return buildKeepzConfigErrorResponse(error);
      }
      if (error instanceof KeepzApiError) {
        logKeepzApiError(
          "cancel",
          {
            cartId,
            orderCode: payload.orderCode,
          },
          error,
        );
        set.status = error.httpStatus || 502;
        return buildKeepzErrorResponse(error);
      }

      logger.error("[Cart Route] Failed to cancel installment order", {
        cartId,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return {
        error: "Failed to cancel installment order",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  })
  .post("/:cartId/checkout/installments/refund", async ({ params, body, auth, set }) => {
    const { cartId } = params as { cartId: string };

    let payload: z.infer<typeof installmentRefundSchema>;
    try {
      payload = installmentRefundSchema.parse(body);
    } catch (error) {
      set.status = 400;
      return {
        error: "Invalid refund payload",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const [cart] = await db
        .select({ id: carts.id, userId: carts.userId })
        .from(carts)
        .where(eq(carts.id, cartId))
        .limit(1);

      if (!cart) {
        set.status = 404;
        return { error: "Cart not found" };
      }

      if (cart.userId && auth?.userId !== cart.userId) {
        set.status = 403;
        return { error: "Forbidden: You don't have access to this cart" };
      }

      if (payload.provider !== "keepz") {
        set.status = 400;
        return { error: "Refund is supported only for Keepz orders" };
      }

      // Validate the order exists and is in a refundable state before
      // calling the payment provider — prevents self-refund on incomplete orders.
      const [existingOrderForRefund] = await db
        .select({ id: orders.id, status: orders.status, total: orders.total })
        .from(orders)
        .where(eq(orders.installmentOrderCode, payload.orderCode))
        .limit(1);

      if (!existingOrderForRefund) {
        set.status = 404;
        return { error: "Order not found for this order code" };
      }

      if (existingOrderForRefund.status !== "completed") {
        set.status = 409;
        return { error: "Only completed orders can be refunded" };
      }

      const orderTotal = Number(existingOrderForRefund.total);
      if (!Number.isFinite(orderTotal) || payload.amount > orderTotal) {
        set.status = 400;
        return { error: "Refund amount exceeds order total", maxRefundable: orderTotal };
      }

      if (!isKeepzEcommerceConfigured()) {
        set.status = 503;
        return buildKeepzNotConfiguredResponse();
      }

      const refund = await refundKeepzOrder({
        integratorOrderId: payload.orderCode,
        amount: payload.amount,
        refundInitiator: "INTEGRATOR",
      });
      const normalizedStatus = refund.status.toUpperCase();
      const [existingOrder] = await db
        .select({ id: orders.id, status: orders.status, installmentFlowStage: orders.installmentFlowStage })
        .from(orders)
        .where(eq(orders.installmentOrderCode, payload.orderCode))
        .limit(1);

      if (existingOrder) {
        const orderPatch: Partial<typeof orders.$inferInsert> = {
          installmentStatusId: null,
          installmentStatusName: normalizedStatus,
          installmentFlowStage: toKeepzFlowStage(normalizedStatus, existingOrder.installmentFlowStage),
        };

        if (
          normalizedStatus === "REFUNDED_BY_OPERATOR" ||
          normalizedStatus === "REFUNDED_BY_INTEGRATOR" ||
          normalizedStatus === "REFUNDED_BY_KEEPZ"
        ) {
          orderPatch.status = "refunded";
        } else if (normalizedStatus === "PARTIALLY_REFUNDED") {
          orderPatch.status = "partially_refunded";
        }

        await db.update(orders).set(orderPatch).where(eq(orders.id, existingOrder.id));
      }

      return {
        orderCode: payload.orderCode,
        statusName: normalizedStatus,
        statusProvider: "keepz",
        raw: refund.raw,
      };
    } catch (error) {
      if (error instanceof KeepzConfigError) {
        logKeepzConfigError(
          "refund",
          {
            cartId,
            orderCode: payload.orderCode,
            amount: payload.amount,
          },
          error,
        );
        set.status = 503;
        return buildKeepzConfigErrorResponse(error);
      }
      if (error instanceof KeepzApiError) {
        logKeepzApiError(
          "refund",
          {
            cartId,
            orderCode: payload.orderCode,
            amount: payload.amount,
          },
          error,
        );
        set.status = error.httpStatus || 502;
        return buildKeepzErrorResponse(error);
      }

      logger.error("[Cart Route] Failed to refund installment order", {
        cartId,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return {
        error: "Failed to refund installment order",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  })
  .post("/:cartId/checkout/installments/status", async ({ params, body, auth, set }) => {
    const { cartId } = params as { cartId: string };

    let payload: z.infer<typeof installmentStatusSchema>;
    try {
      payload = installmentStatusSchema.parse(body);
    } catch (error) {
      set.status = 400;
      return {
        error: "Invalid status payload",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const [cart] = await db
        .select({ id: carts.id, status: carts.status, userId: carts.userId })
        .from(carts)
        .where(eq(carts.id, cartId))
        .limit(1);

      if (!cart) {
        set.status = 404;
        return { error: "Cart not found" };
      }

      if (cart.userId && auth?.userId !== cart.userId) {
        set.status = 403;
        return { error: "Forbidden: You don't have access to this cart" };
      }

      const provider = inferStatusProvider(payload, cartId);
      let checkoutCompleted = cart.status === "completed";
      let checkoutResult: CheckoutResult | null = null;
      const [existingOrder] = await db
        .select({
          id: orders.id,
          status: orders.status,
          installmentFlowStage: orders.installmentFlowStage,
        })
        .from(orders)
        .where(eq(orders.installmentOrderCode, payload.orderCode))
        .limit(1);

      if (provider === "credo") {
        if (!validateOrderCodeForCart(payload.orderCode, cartId)) {
          set.status = 400;
          return { error: "Order code does not match this cart" };
        }

        logger.info("[Cart Route] Syncing Credo installment status", {
          cartId,
          orderCode: payload.orderCode,
        });

        const statusResult = await fetchCredoInstallmentStatus(payload.orderCode);
        logger.info("[Cart Route] Credo installment status response", {
          cartId,
          orderCode: payload.orderCode,
          statusId: statusResult.statusId,
          statusName: statusResult.statusName,
        });

        const nextFlowStage = toInstallmentFlowStage(
          statusResult.statusId,
          existingOrder?.installmentFlowStage ?? null,
        );

        if (existingOrder) {
          const orderPatch: Partial<typeof orders.$inferInsert> = {
            installmentStatusId: statusResult.statusId,
            installmentStatusName: statusResult.statusName,
            installmentFlowStage: nextFlowStage,
          };

          if (statusResult.statusId === 5 && existingOrder.status !== "completed") {
            orderPatch.status = "completed";
            orderPatch.installmentDeliveredAt = new Date();
            orderPatch.installmentVerificationCode = null;
          } else if (
            CREDO_CANCELLED_STATUS_IDS.has(statusResult.statusId ?? Number.NaN) &&
            existingOrder.status !== "completed"
          ) {
            orderPatch.status = "cancelled";
          }

          await db.update(orders).set(orderPatch).where(eq(orders.id, existingOrder.id));
          checkoutCompleted =
            orderPatch.status === "completed" || existingOrder.status === "completed";
        } else if (
          cart.status === "open" &&
          CREDO_APPROVED_STATUS_IDS.has(statusResult.statusId ?? 0)
        ) {
          checkoutResult = await completeCartCheckout(cartId, auth?.userId ?? null, {
            paymentMethod: "installments_credo",
            orderStatus: nextFlowStage === "completed" ? "completed" : "approved",
            installmentOrderCode: payload.orderCode,
            installmentStatusId: statusResult.statusId,
            installmentStatusName: statusResult.statusName,
            installmentFlowStage: nextFlowStage ?? "approved",
          });
          checkoutCompleted = true;
        }

        return {
          orderCode: payload.orderCode,
          statusId: statusResult.statusId,
          statusName: statusResult.statusName,
          checkoutCompleted,
          orders: checkoutResult?.orders ?? null,
          raw: statusResult.raw,
          statusProvider: "credo",
        };
      }

      if (!isKeepzEcommerceConfigured()) {
        set.status = 503;
        return buildKeepzNotConfiguredResponse();
      }

      logger.info("[Cart Route] Syncing Keepz checkout status", {
        cartId,
        orderCode: payload.orderCode,
      });

      const statusResult = await getKeepzOrderStatus(payload.orderCode);
      const keepzStatus = statusResult.status.toUpperCase();
      const nextFlowStage = toKeepzFlowStage(keepzStatus, existingOrder?.installmentFlowStage ?? null);

      if (existingOrder) {
        const orderPatch: Partial<typeof orders.$inferInsert> = {
          installmentStatusId: null,
          installmentStatusName: keepzStatus,
          installmentFlowStage: nextFlowStage,
        };

        if (KEEPZ_SUCCESS_STATUSES.has(keepzStatus) && existingOrder.status !== "completed") {
          orderPatch.status = "completed";
          orderPatch.installmentDeliveredAt = new Date();
          orderPatch.installmentVerificationCode = null;
        } else if (
          KEEPZ_CANCELLED_STATUSES.has(keepzStatus) &&
          existingOrder.status !== "completed"
        ) {
          orderPatch.status = "cancelled";
        }

        await db.update(orders).set(orderPatch).where(eq(orders.id, existingOrder.id));
        checkoutCompleted = orderPatch.status === "completed" || existingOrder.status === "completed";
      } else if (cart.status === "open" && KEEPZ_SUCCESS_STATUSES.has(keepzStatus)) {
        checkoutResult = await completeCartCheckout(cartId, auth?.userId ?? null, {
          paymentMethod: payload.paymentType === "card" ? "card_keepz" : "installments_keepz",
          orderStatus: "completed",
          installmentOrderCode: payload.orderCode,
          installmentStatusId: null,
          installmentStatusName: keepzStatus,
          installmentFlowStage: nextFlowStage ?? "completed",
        });
        checkoutCompleted = true;
      }

      return {
        orderCode: payload.orderCode,
        statusId: null,
        statusName: keepzStatus,
        checkoutCompleted,
        orders: checkoutResult?.orders ?? null,
        raw: statusResult.raw,
        statusProvider: "keepz",
      };
    } catch (error) {
      if (error instanceof KeepzConfigError) {
        logKeepzConfigError(
          "status",
          {
            cartId,
            orderCode: payload.orderCode,
            paymentType: payload.paymentType ?? null,
          },
          error,
        );
        set.status = 503;
        return buildKeepzConfigErrorResponse(error);
      }
      if (error instanceof KeepzApiError) {
        if (error.httpStatus === 404) {
          return {
            orderCode: payload.orderCode,
            statusId: null,
            statusName: "PENDING",
            checkoutCompleted: false,
            orders: null,
            statusProvider: "keepz",
          };
        }
        logKeepzApiError(
          "status",
          {
            cartId,
            orderCode: payload.orderCode,
            paymentType: payload.paymentType ?? null,
          },
          error,
        );
        set.status = error.httpStatus || 502;
        return buildKeepzErrorResponse(error);
      }

      logger.error("[Cart Route] Failed to sync installment status", {
        cartId,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return {
        error: "Failed to sync installment status",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
