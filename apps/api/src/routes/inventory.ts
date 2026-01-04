import { db, inventoryLedger } from "@repo/db";
import { Elysia, t } from "elysia";
import {
  INVENTORY_REASONS,
  adminGuard,
  getAvailableStock,
  getTenantIdBySlug,
  inventoryReserveSchema,
} from "../context";

type InventoryParams = { shopSlug: string };

export const inventoryRoutes = new Elysia({
  prefix: "/shops/:shopSlug/inventory",
})
  .use(adminGuard)
  .guard({
    params: t.Object({ shopSlug: t.String() }),
  })
  .post("/reserve", async ({ params, body }: { params: InventoryParams; body: unknown }) => {
    const payload = inventoryReserveSchema.parse(body);
    const tenantId = await getTenantIdBySlug(params.shopSlug);
    const available = await getAvailableStock(tenantId, payload.variantId);
    if (payload.qty > available) {
      return new Response("Insufficient stock to reserve", { status: 409 });
    }

    await db.insert(inventoryLedger).values({
      id: crypto.randomUUID(),
      tenantId,
      variantId: payload.variantId,
      delta: -Math.abs(payload.qty),
      reason: INVENTORY_REASONS.RESERVE,
      refType: payload.refType ?? "manual",
      refId: payload.refId,
    });
    return { variantId: payload.variantId, availableAfter: available - payload.qty };
  })
  .post("/release", async ({ params, body }: { params: InventoryParams; body: unknown }) => {
    const payload = inventoryReserveSchema.parse(body);
    const tenantId = await getTenantIdBySlug(params.shopSlug);
    await db.insert(inventoryLedger).values({
      id: crypto.randomUUID(),
      tenantId,
      variantId: payload.variantId,
      delta: Math.abs(payload.qty),
      reason: INVENTORY_REASONS.RELEASE,
      refType: payload.refType ?? "manual",
      refId: payload.refId,
    });
    const available = await getAvailableStock(tenantId, payload.variantId);
    return { variantId: payload.variantId, available };
  });
