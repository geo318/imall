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
import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import type z from "zod";
import {
  INVENTORY_REASONS,
  cartItemSchema,
  createCartSchema,
  getAvailableStock,
  getTenantIdBySlug,
} from "../context";

export const cartRoutes = new Elysia({ prefix: "/shops/:shopSlug/carts" })
  .post("/", async ({ params, body, set }) => {
    try {
      const tenantId = await getTenantIdBySlug(params.shopSlug);
      let payload: unknown = body;
      if (payload && typeof payload === "object") {
        payload = createCartSchema.parse(payload);
      } else {
        payload = {};
      }
      const { userId } = payload as { userId?: string };
      const [inserted] = await db
        .insert(carts)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          userId,
        })
        .returning({ id: carts.id });
      set.status = 201;
      return { id: inserted?.id, status: "open" };
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to create cart";
    }
  })
  .get("/:cartId", async ({ params, set }) => {
    try {
      const tenantId = await getTenantIdBySlug(params.shopSlug);
      const cartId = params.cartId;
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
        .where(and(eq(carts.id, cartId), eq(carts.tenantId, tenantId)))
        .limit(1);
      if (!cart) {
        set.status = 404;
        return "Cart not found";
      }
      const items = await db
        .select({
          id: cartItems.id,
          qty: cartItems.qty,
          variantId: cartItems.variantId,
          sku: variants.sku,
          price: variants.price,
          currency: variants.currency,
          productTitle: products.title,
          productSlug: products.slug,
        })
        .from(cartItems)
        .innerJoin(variants, eq(cartItems.variantId, variants.id))
        .innerJoin(products, eq(variants.productId, products.id))
        .where(
          and(
            eq(cartItems.cartId, cartId),
            eq(cartItems.tenantId, tenantId),
            eq(variants.tenantId, tenantId),
          ),
        );
      return { cart, items };
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to load cart";
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
    const tenantId = await getTenantIdBySlug(params.shopSlug);
    const cartId = params.cartId;

    try {
      const result = await db.transaction(async (tx) => {
        const [variant] = await tx
          .select({ id: variants.id })
          .from(variants)
          .where(and(eq(variants.id, variantId), eq(variants.tenantId, tenantId)))
          .limit(1);
        if (!variant) {
          throw new Response("Variant not found", { status: 404 });
        }

        const [existing] = await tx
          .select({ id: cartItems.id, qty: cartItems.qty })
          .from(cartItems)
          .where(
            and(
              eq(cartItems.cartId, cartId),
              eq(cartItems.variantId, variantId),
              eq(cartItems.tenantId, tenantId),
            ),
          )
          .limit(1);

        let itemId: string;
        let newQty: number;
        if (existing) {
          newQty = existing.qty + qty;
          await tx.update(cartItems).set({ qty: newQty }).where(eq(cartItems.id, existing.id));
          itemId = existing.id;
        } else {
          itemId = crypto.randomUUID();
          newQty = qty;
          await tx.insert(cartItems).values({
            id: itemId,
            tenantId,
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
      const message = err instanceof Error ? err.message : "Failed to add to cart";
      set.status = 500;
      return message;
    }
  })
  .post("/:cartId/checkout", async ({ params, set }) => {
    const tenantId = await getTenantIdBySlug(params.shopSlug);
    const cartId = params.cartId;

    try {
      const result = await db.transaction(async (tx) => {
        const cartWithItems = await tx
          .select({
            cartId: carts.id,
            status: carts.status,
            variantId: cartItems.variantId,
            qty: cartItems.qty,
            price: variants.price,
            currency: variants.currency,
            productId: variants.productId,
          })
          .from(carts)
          .leftJoin(cartItems, eq(cartItems.cartId, carts.id))
          .leftJoin(variants, eq(cartItems.variantId, variants.id))
          .where(and(eq(carts.id, cartId), eq(carts.tenantId, tenantId)));

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
            qty: number;
            price: string;
          } => Boolean(row.variantId && row.qty !== null && row.price !== null),
        );
        if (items.length === 0) {
          throw new Response("Cart is empty", { status: 400 });
        }

        for (const item of items) {
          if (!item.variantId) {
            continue;
          }

          const available = await getAvailableStock(tenantId, item.variantId);
          if (available < (item.qty ?? 0)) {
            throw new Response("Insufficient stock", { status: 409 });
          }
        }

        const currency = items[0]?.currency ?? "USD";
        const total = items.reduce((sum, item) => {
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

        for (const item of items) {
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

        await tx
          .update(carts)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(carts.id, cartId));

        return { orderId: order.id, total, currency };
      });

      set.status = 201;
      return result;
    } catch (err) {
      if (err instanceof Response) return err;
      const message = err instanceof Error ? err.message : "Checkout failed";
      set.status = 500;
      return message;
    }
  });
