import { db, inventoryLedger, tenants } from "@repo/db";
import { INVENTORY_REASONS, env as sharedEnv } from "@repo/shared";
import { and, eq, sum } from "drizzle-orm";
import { Elysia } from "elysia";
import type { ElysiaWS } from "elysia/dist/ws";

import { z } from "zod";
import { logger } from "./utils/logger";
import { extractTokenFromHeader, verifyClerkToken } from "./utils/token";

export const env = sharedEnv;

/* ---------- Auth ---------- */
export type AuthContext = {
  userId: string | null;
  sessionId: string | null;
  orgId: string | null;
  orgRole: string | null;
  orgSlug: string | null;
  role?: "admin" | "staff" | "viewer";
  // Additional Clerk auth properties
  claims?: Record<string, unknown>;
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

export const authPlugin = new Elysia<"", AuthSingleton>({
  name: "auth",
}).derive(async ({ request }) => {
  const method = request.method;
  const pathname = new URL(request.url).pathname;

  // Try both lowercase and capitalized header names (HTTP headers are case-insensitive but some implementations are strict)
  const authHeaderLower = request.headers.get("authorization");
  const authHeaderUpper = request.headers.get("Authorization");
  const authHeader = authHeaderLower || authHeaderUpper;

  // Extract token using utility
  const token = extractTokenFromHeader(authHeader);

  let authContext: AuthContext = {
    userId: null,
    sessionId: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    role: undefined,
    claims: undefined,
  };

  if (token) {
    try {
      const verified = await verifyClerkToken(token);
      authContext = {
        userId: verified.userId,
        sessionId: verified.sessionId,
        orgId: verified.orgId,
        orgRole: verified.orgRole,
        orgSlug: verified.orgSlug,
        role: verified.role,
        claims: verified.claims,
      };

      logger.debug(`[Auth] ${method} ${pathname} - Authenticated:`, {
        userId: authContext.userId,
        sessionId: authContext.sessionId,
      });
    } catch (error) {
      // Token verification failed - auth context remains unauthenticated
      logger.debug(`[Auth] ${method} ${pathname} - Token verification failed:`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    logger.debug(`[Auth] ${method} ${pathname} - No Authorization header found`);
  }

  return { auth: authContext };
});

export function requireAdmin(ctx: AuthContext) {
  if (ctx.role !== "admin" && ctx.role !== "staff") {
    throw new Response("Forbidden", { status: 403 });
  }
}

export function isSuperadminRequest(request: Request) {
  const email = request.headers.get("x-superadmin-email");
  const password = request.headers.get("x-superadmin-password");
  return Boolean(email && password && email === env.SUPERADMIN_EMAIL && password === env.SUPERADMIN_PASSWORD);
}

export const adminGuard = new Elysia({ name: "admin-guard" })
  .use(authPlugin)
  .onBeforeHandle(({ auth }) => {
    requireAdmin(auth);
  });

export const adminOrSuperadminGuard = new Elysia({ name: "admin-superadmin-guard" })
  .use(authPlugin)
  .onBeforeHandle(({ auth, request }) => {
    if (isSuperadminRequest(request)) {
      return;
    }
    requireAdmin(auth);
  });

export const superadminGuard = new Elysia({ name: "superadmin-guard" }).onBeforeHandle(
  ({ request }) => {
    if (!isSuperadminRequest(request)) {
      throw new Response("Forbidden", { status: 403 });
    }
  },
);

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

// Note: userId is now extracted from Clerk auth token, not from request body
// This schema is kept for backward compatibility but is no longer used
export const createCartSchema = z.object({});

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

export async function getTenantBySlug(slug: string): Promise<{
  id: string;
  canSell: boolean;
  canAuction: boolean;
}> {
  const [tenant] = await db
    .select({ id: tenants.id, canSell: tenants.canSell, canAuction: tenants.canAuction })
    .from(tenants)
    .where(eq(tenants.shopSlug, slug))
    .limit(1);
  if (!tenant) {
    const error = new Error("Tenant not found");
    error.name = "TenantNotFound";
    throw error;
  }
  return tenant;
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
