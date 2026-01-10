import {
  cartItems,
  carts,
  db,
  inventoryLedger,
  orderItems,
  orders,
  products,
  variants,
} from "@repo/db";
import { and, eq, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { INVENTORY_REASONS, cartItemSchema, createCartSchema, getAvailableStock } from "../context";

// Cart routes - single cart that can hold items from multiple shops
export const cartRoutes = new Elysia({ prefix: "/carts" })
  .get("/", async () => {
    console.log("[Cart Route] GET /carts - Health check");
    return { status: "ok", message: "Cart routes are working" };
  })
  .post("/", async ({ body, set }) => {
    console.log("[Cart Route] POST /carts - Creating cart");
    try {
      let payload: unknown = body;
      if (payload && typeof payload === "object") {
        payload = createCartSchema.parse(payload);
      } else {
        payload = {};
      }
      const { userId } = payload as { userId?: string };
      console.log("[Cart Route] Creating cart with userId:", userId);

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
      console.log("[Cart Route] Cart created:", inserted?.id);
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
  .get("/:cartId", async ({ params, set }) => {
    try {
      const cartId = params.cartId;
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
        })
        .from(cartItems)
        .innerJoin(variants, eq(cartItems.variantId, variants.id))
        .innerJoin(products, eq(variants.productId, products.id))
        .where(eq(cartItems.cartId, cartId));

      // Attach availability for each item (small N, ok for cart sizes)
      const itemsWithAvailability = await Promise.all(
        items.map(async (item) => {
          const availableQty = await getAvailableStock(item.tenantId, item.variantId);
          return { ...item, availableQty };
        }),
      );

      return { id: cart.id, status: cart.status, items: itemsWithAvailability };
    } catch (err) {
      if (err instanceof Response) {
        set.status = err.status;
        return { error: err.statusText || "Not found" };
      }
      console.error("[Cart Route] Failed to load cart:", params.cartId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to load cart",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .post("/:cartId/items", async ({ params, body, set }) => {
    let payload: unknown;
    try {
      payload = cartItemSchema.parse(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid item payload";
      return new Response(message, { status: 400 });
    }
    const { variantId, qty } = payload as z.infer<typeof cartItemSchema>;
    const cartId = params.cartId;

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

        // Verify cart exists
        const [cart] = await tx
          .select({ id: carts.id })
          .from(carts)
          .where(eq(carts.id, cartId))
          .limit(1);
        if (!cart) {
          throw new Response("Cart not found", { status: 404 });
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
        return { error: "Insufficient stock", message: `Only ${available} available` };
      }
      console.error("[Cart Route] Failed to add item to cart:", params.cartId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to add to cart",
        message: errMsg,
      };
    }
  })
  .patch("/:cartId/items/:itemId", async ({ params, body, set }) => {
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

    const cartId = params.cartId;
    const itemId = params.itemId;
    const qty = payload.qty;

    try {
      const result = await db.transaction(async (tx) => {
        // Verify item belongs to cart
        const [item] = await tx
          .select({
            id: cartItems.id,
            qty: cartItems.qty,
            tenantId: cartItems.tenantId,
            variantId: cartItems.variantId,
          })
          .from(cartItems)
          .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
          .limit(1);

        if (!item) {
          throw new Response("Cart item not found", { status: 404 });
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
        return { error: "Insufficient stock", message: `Only ${available} available` };
      }
      console.error("[Cart Route] Failed to update cart item:", params.cartId, params.itemId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to update cart item",
        message: errMsg,
      };
    }
  })
  .delete("/:cartId/items/:itemId", async ({ params, set }) => {
    const cartId = params.cartId;
    const itemId = params.itemId;

    try {
      await db.transaction(async (tx) => {
        const [item] = await tx
          .select({ id: cartItems.id })
          .from(cartItems)
          .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cartId)))
          .limit(1);
        if (!item) {
          throw new Response("Cart item not found", { status: 404 });
        }

        await tx.delete(cartItems).where(eq(cartItems.id, itemId));
        await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
      });

      set.status = 204;
      return;
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("[Cart Route] Failed to remove cart item:", params.cartId, params.itemId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Failed to remove cart item",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  })
  .post("/:cartId/checkout", async ({ params, set }) => {
    const cartId = params.cartId;

    try {
      const result = await db.transaction(async (tx) => {
        // Get cart and all items
        const cartWithItems = await tx
          .select({
            cartId: carts.id,
            status: carts.status,
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

        // Check stock for each item (using its own tenantId)
        for (const item of items) {
          if (!item.variantId || !item.tenantId) {
            continue;
          }

          const available = await getAvailableStock(item.tenantId, item.variantId);
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
              status: "pending",
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

      set.status = 201;
      return result;
    } catch (err) {
      if (err instanceof Response) return err;
      console.error("[Cart Route] Failed to checkout cart:", params.cartId);
      console.error("[Cart Route] Error:", err);
      set.status = 500;
      return {
        error: "Checkout failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });
