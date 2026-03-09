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
  INVENTORY_REASONS,
} from "../context";
import {
  type CredoInstallmentProduct,
  createCredoInstallmentApplication,
  fetchCredoInstallmentStatus,
  isInstallmentCheckoutReadyStatus,
  validateOrderCodeForCart,
} from "../integrations/credo-installments";
import { sanitizePersistedImageUrls } from "../utils/image-urls";
import { logger } from "../utils/logger";

const installmentStartSchema = z.object({
  installmentLength: z.coerce.number().int().positive().max(60).optional(),
  clientFullName: z.string().trim().max(128).optional(),
  mobile: z.string().trim().max(32).optional(),
  email: z.string().email().max(256).optional(),
  factAddress: z.string().trim().max(256).optional(),
});

const installmentStatusSchema = z.object({
  orderCode: z.string().trim().min(16).max(50),
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
};

async function completeCartCheckout(
  cartId: string,
  authUserId: string | null,
  options: CompleteCartCheckoutOptions = {},
): Promise<CheckoutResult> {
  return db.transaction(async (tx) => {
    // Get cart and all items
    const cartWithItems = await tx
      .select({
        cartId: carts.id,
        status: carts.status,
        userId: carts.userId,
        variantId: cartItems.variantId,
        tenantId: cartItems.tenantId, // Each item's tenant
        qty: cartItems.qty,
        price: variants.price,
        currency: variants.currency,
        productId: variants.productId,
      })
      .from(carts)
      .leftJoin(cartItems, eq(cartItems.cartId, carts.id))
      .leftJoin(variants, eq(cartItems.variantId, variants.id))
      .where(eq(carts.id, cartId));

    if (cartWithItems.length === 0) {
      throw new Response("Cart not found", { status: 404 });
    }

    // Authorization: If cart has a userId, ensure the authenticated user matches
    const cartUserId = cartWithItems[0]?.userId;
    if (cartUserId && authUserId !== cartUserId) {
      throw new Response("Forbidden: You don't have access to this cart", {
        status: 403,
      });
    }

    if (cartWithItems[0]?.status !== "open") {
      throw new Response("Cart is not open", { status: 409 });
    }

    const items = cartWithItems.filter(
      (
        row,
      ): row is (typeof cartWithItems)[number] & {
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
          status: "pending",
          paymentMethod: options.paymentMethod ?? "card",
          manualSale: options.manualSale ?? false,
          manualSaleComment: options.manualSaleComment?.trim() || null,
          total: String(total),
          currency,
        })
        .returning({ id: orders.id });
      if (!order) {
        throw new Response("Order creation failed", { status: 500 });
      }

      for (const item of tenantItems) {
        await tx.insert(orderItems).values({
          id: crypto.randomUUID(),
          tenantId,
          orderId: order.id,
          variantId: item.variantId,
          qty: item.qty,
          unitPrice: item.price,
        });

        await tx.insert(inventoryLedger).values({
          id: crypto.randomUUID(),
          tenantId,
          variantId: item.variantId,
          delta: -Math.abs(item.qty),
          reason: INVENTORY_REASONS.SALE,
          refType: "order",
          refId: order.id,
        });
      }

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
      if (!cart) {
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

      const stockByTenant = new Map<string, Map<string, number>>();
      await Promise.all(
        Array.from(variantIdsByTenant.entries()).map(async ([tenantId, variantIds]) => {
          const stockMap = await getAvailableStockMap(tenantId, Array.from(variantIds));
          stockByTenant.set(tenantId, stockMap);
        }),
      );

      // Attach availability and parse image URLs for each item
      const itemsWithAvailability = items.map((item) => {
        const availableQty = stockByTenant.get(item.tenantId)?.get(item.variantId) ?? 0;

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
          .select({ id: carts.id, userId: carts.userId })
          .from(carts)
          .where(eq(carts.id, cartId))
          .limit(1);
        if (!cart) {
          throw new Response("Cart not found", { status: 404 });
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
          })
          .from(cartItems)
          .innerJoin(carts, eq(cartItems.cartId, carts.id))
          .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
          .limit(1);

        if (!item) {
          throw new Response("Cart item not found", { status: 404 });
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
          .select({ id: cartItems.id, cartUserId: carts.userId })
          .from(cartItems)
          .innerJoin(carts, eq(cartItems.cartId, carts.id))
          .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
          .limit(1);
        if (!item) {
          throw new Response("Cart item not found", { status: 404 });
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

      const cartItemsForCredo = rows.filter(
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

      if (cartItemsForCredo.length === 0) {
        set.status = 400;
        return { error: "Cart is empty" };
      }

      const distinctTenantIds = new Set(cartItemsForCredo.map((item) => item.tenantId));
      if (distinctTenantIds.size > 1) {
        set.status = 409;
        return {
          error: "Online installments are available only for single-vendor carts",
          code: "INSTALLMENTS_SINGLE_VENDOR_REQUIRED",
        };
      }

      const firstCartItem = cartItemsForCredo[0];
      if (!firstCartItem) {
        set.status = 400;
        return { error: "Cart is empty" };
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

      // Reuse stock checks from standard checkout to avoid sending impossible applications.
      const variantIdsByTenant = new Map<string, Set<string>>();
      for (const item of cartItemsForCredo) {
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

      for (const item of cartItemsForCredo) {
        const available = stockByTenant.get(item.tenantId)?.get(item.variantId) ?? 0;
        if (available < item.qty) {
          set.status = 409;
          return {
            error: "Insufficient stock",
            message: `${item.productTitle} has only ${available} available`,
          };
        }
      }

      const credoProducts: CredoInstallmentProduct[] = cartItemsForCredo.map((item) => {
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
      const subtotal = cartItemsForCredo.reduce(
        (sum, item) => sum + Number(item.price) * item.qty,
        0,
      );
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

      logger.debug("[Cart Route] Created Credo installment session", {
        cartId,
        orderCode: session.orderCode,
      });

      return {
        orderCode: session.orderCode,
        redirectUrl: session.redirectUrl,
      };
    } catch (error) {
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

      if (!validateOrderCodeForCart(payload.orderCode, cartId)) {
        set.status = 400;
        return { error: "Order code does not match this cart" };
      }

      const statusResult = await fetchCredoInstallmentStatus(payload.orderCode);
      let checkoutCompleted = cart.status === "completed";
      let checkoutResult: CheckoutResult | null = null;

      if (
        !checkoutCompleted &&
        cart.status === "open" &&
        isInstallmentCheckoutReadyStatus(statusResult.statusId)
      ) {
        checkoutResult = await completeCartCheckout(cartId, auth?.userId ?? null, {
          paymentMethod: "installments_credo",
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
      };
    } catch (error) {
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
