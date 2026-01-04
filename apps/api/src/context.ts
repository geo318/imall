import { db, inventoryLedger, products, tenants, variants } from "@repo/db";
import { INVENTORY_REASONS, loadServerEnv } from "@repo/shared";
import { and, eq, sum } from "drizzle-orm";
import { Elysia } from "elysia";
import type { ElysiaWS } from "elysia/dist/ws";

import { z } from "zod";

export const env = loadServerEnv(process.env);

/* ---------- Auth ---------- */
export type AuthContext = {
  userId?: string;
  role?: "admin" | "staff" | "viewer";
};

type AuthSingleton = {
  decorator: Record<string, never>;
  store: Record<string, never>;
  derive: { auth: AuthContext };
  resolve: Record<string, never>;
};

export type WsContext<Extras extends Record<string, unknown> = Record<string, never>> = ElysiaWS<
  { auth?: AuthContext } & Extras
>;

export const authPlugin = new Elysia<"", AuthSingleton>({ name: "auth" }).derive(({ request }) => {
  const demoUser = request.headers.get("x-demo-user");
  const demoRole = (request.headers.get("x-demo-role") as AuthContext["role"]) ?? "admin";
  return {
    auth: {
      userId: demoUser ?? undefined,
      role: demoRole,
    } satisfies AuthContext,
  };
});

export function requireAdmin(ctx: AuthContext) {
  if (ctx.role !== "admin" && ctx.role !== "staff") {
    throw new Response("Forbidden", { status: 403 });
  }
}

export const adminGuard = new Elysia({ name: "admin-guard" })
  .use(authPlugin)
  .onBeforeHandle(({ auth }) => {
    requireAdmin(auth);
  });

/* ---------- Validation schemas ---------- */
export const bidPayloadSchema = z.object({
  amount: z
    .string()
    .or(z.number())
    .transform((val) => Number(val))
    .refine((v) => !Number.isNaN(v) && v > 0, "Bid amount must be positive"),
  bidderId: z.string().uuid(),
});

export const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50))
    .refine((v) => Number.isFinite(v) && v > 0 && v <= 200, "Limit invalid"),
});

export const createCartSchema = z.object({
  userId: z.string().uuid().optional(),
});

export const cartItemSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.coerce.number().int().positive(),
});

export const inventoryReserveSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.coerce.number().int().positive(),
  refType: z.string().optional(),
  refId: z.string().uuid().optional(),
});

/* ---------- Helpers ---------- */
export async function getTenantIdBySlug(slug: string): Promise<string> {
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.shopSlug, slug))
    .limit(1);
  if (!tenant) {
    throw new Response("Tenant not found", { status: 404 });
  }
  return tenant.id;
}

export async function getAvailableStock(tenantId: string, variantId: string) {
  const [row] = await db
    .select({ onHand: sum(inventoryLedger.delta) })
    .from(inventoryLedger)
    .where(and(eq(inventoryLedger.tenantId, tenantId), eq(inventoryLedger.variantId, variantId)));
  return Number(row?.onHand ?? 0);
}

export async function decrementStock(
  tx: typeof db,
  tenantId: string,
  variantId: string,
  qty: number,
  ref: { refType: string; refId?: string },
) {
  await tx.insert(inventoryLedger).values({
    id: crypto.randomUUID(),
    tenantId,
    variantId,
    delta: -Math.abs(qty),
    reason: INVENTORY_REASONS.SALE,
    refType: ref.refType,
    refId: ref.refId,
  });
}

export function validate<T>(schema: z.ZodType<T>, data: unknown) {
  return schema.parse(data);
}

export { INVENTORY_REASONS };
