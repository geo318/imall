import { db, orderItems, orders, tenants, users } from "@repo/db";
import { desc, eq, sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { authPlugin } from "../context";
import { ensureAuth, requireAuth } from "../utils/auth";

function serializeOrder(order: {
  id: string;
  tenantId: string;
  shopSlug: string | null;
  shopName: string | null;
  status: string | null;
  paymentMethod: string;
  total: string;
  currency: string;
  createdAt: Date;
  itemCount: number;
}) {
  return {
    id: order.id,
    tenantId: order.tenantId,
    shopSlug: order.shopSlug,
    shopName: order.shopName,
    status: order.status,
    paymentMethod: order.paymentMethod,
    total: order.total,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    itemCount: Number(order.itemCount ?? 0),
  };
}

async function findUserIdByExternalAuthId(externalAuthId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.externalAuthId, externalAuthId))
    .limit(1);
  return user?.id ?? null;
}

export const userOrderRoutes = new Elysia({
  prefix: "/users",
})
  .use(authPlugin)
  .get("/me/orders", async ({ auth, request, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      const authenticated = requireAuth(effectiveAuth);
      const userId = await findUserIdByExternalAuthId(authenticated.userId);
      if (!userId) {
        return { orders: [] };
      }

      const rows = await db
        .select({
          id: orders.id,
          tenantId: orders.tenantId,
          shopSlug: tenants.shopSlug,
          shopName: tenants.name,
          status: orders.status,
          paymentMethod: orders.paymentMethod,
          total: orders.total,
          currency: orders.currency,
          createdAt: orders.createdAt,
          itemCount: sql<number>`coalesce(sum(${orderItems.qty}), 0)`,
        })
        .from(orders)
        .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
        .leftJoin(tenants, eq(tenants.id, orders.tenantId))
        .where(eq(orders.userId, userId))
        .groupBy(
          orders.id,
          orders.tenantId,
          orders.status,
          orders.paymentMethod,
          orders.total,
          orders.currency,
          orders.createdAt,
          tenants.shopSlug,
          tenants.name,
        )
        .orderBy(desc(orders.createdAt))
        .limit(50);

      return { orders: rows.map(serializeOrder) };
    } catch (error) {
      if (error instanceof Response) return error;
      set.status = 500;
      return { error: "Failed to load orders" };
    }
  });
