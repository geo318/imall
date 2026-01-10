import { db, inventoryLedger, products, tenants, variants } from "@repo/db";
import { INVENTORY_REASONS, env as sharedEnv } from "@repo/shared";
import { and, eq, sum } from "drizzle-orm";
import { Elysia } from "elysia";
import type { ElysiaWS } from "elysia/dist/ws";

import { z } from "zod";

export const env = sharedEnv;

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

export const authPlugin = new Elysia<"", AuthSingleton>({ name: "auth" }).derive(
  async ({ request }) => {
    // Check for Clerk JWT token in Authorization header
    const authHeader = request.headers.get("authorization");
    let userId: string | undefined;
    let role: AuthContext["role"] = "admin";

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // TODO: Verify Clerk JWT token and extract userId
      // For now, we'll extract from token if it's a valid format
      // In production, verify with Clerk's public key
      try {
        // Basic JWT parsing (without verification for now)
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          userId = payload.sub || payload.user_id;
          // Extract role from token if available
          if (payload.role) {
            role = payload.role;
          }
        }
      } catch {
        // Invalid token format, fall back to demo headers
      }
    }

    // Fall back to demo headers if no token
    if (!userId) {
      const demoUser = request.headers.get("x-demo-user");
      const demoRole = (request.headers.get("x-demo-role") as AuthContext["role"]) ?? "admin";
      userId = demoUser ?? undefined;
      role = demoRole;
    }

    return {
      auth: {
        userId,
        role,
      } satisfies AuthContext,
    };
  },
);

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
  // bidderId is optional - backend gets it from auth token
  bidderId: z.string().uuid().optional(),
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
    const error = new Error("Tenant not found");
    error.name = "TenantNotFound";
    throw error;
  }
  return tenant.id;
}

export async function getAvailableStock(tenantId: string, variantId: string) {
  const [row] = await db
    .select({ onHand: sum(inventoryLedger.delta) })
    .from(inventoryLedger)
    .where(and(eq(inventoryLedger.tenantId, tenantId), eq(inventoryLedger.variantId, variantId)));
  // PostgreSQL sum() returns null when no rows exist, convert to 0
  const stock = row?.onHand ? Number(row.onHand) : 0;
  return stock;
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
