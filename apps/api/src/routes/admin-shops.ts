import { db, inventoryLedger, orderItems, orders, tenants, variants } from "@repo/db";
import { eq, desc, inArray, sql, sum } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { adminGuard, getTenantIdBySlug } from "../context";

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  settings: z.string().optional(),
});

export const adminShopRoutes = new Elysia({ prefix: "/admin/:shopSlug" })
  .use(adminGuard)
  .get("/settings", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const [tenant] = await db
      .select({ id: tenants.id, name: tenants.name, settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return new Response("Shop not found", { status: 404 });
    }

    return {
      id: tenant.id,
      slug: shopSlug,
      name: tenant.name,
      settings: tenant.settings ?? "{}",
    };
  })
  .patch("/settings", async ({ params, body }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    const payload = settingsSchema.parse(body);

    await db
      .update(tenants)
      .set({
        name: payload.name,
        settings: payload.settings,
      })
      .where(eq(tenants.id, tenantId));

    const [updated] = await db
      .select({ name: tenants.name, settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return {
      name: updated?.name ?? "",
      settings: updated?.settings ?? "{}",
    };
  })
  .get("/inventory", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    const [stockRows, variantRows] = await Promise.all([
      db
        .select({ variantId: inventoryLedger.variantId, available: sum(inventoryLedger.delta) })
        .from(inventoryLedger)
        .where(eq(inventoryLedger.tenantId, tenantId))
        .groupBy(inventoryLedger.variantId)
        .orderBy(inventoryLedger.variantId),
      db
        .select({
          id: variants.id,
          sku: variants.sku,
          price: variants.price,
          currency: variants.currency,
        })
        .from(variants)
        .where(eq(variants.tenantId, tenantId)),
    ]);

    const stockMap = new Map(stockRows.map((row) => [row.variantId, Number(row.available ?? 0)]));

    return variantRows.map((variant) => ({
      variantId: variant.id,
      sku: variant.sku,
      price: variant.price,
      currency: variant.currency,
      available: stockMap.get(variant.id) ?? 0,
    }));
  })
  .get("/orders", async ({ params }) => {
    const { shopSlug } = params as { shopSlug: string };
    const tenantId = await getTenantIdBySlug(shopSlug);

    const orderRows = await db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        currency: orders.currency,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .orderBy(desc(orders.createdAt))
      .limit(20);

    if (orderRows.length === 0) {
      return [];
    }

    const orderIds = orderRows.map((order) => order.id);
    const itemCounts = await db
      .select({ orderId: orderItems.orderId, itemCount: sql`count(*)` })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .groupBy(orderItems.orderId);

    const countMap = new Map(itemCounts.map((row) => [row.orderId, Number(row.itemCount ?? 0)]));

    return orderRows.map((order) => ({
      ...order,
      itemCount: countMap.get(order.id) ?? 0,
    }));
  });
