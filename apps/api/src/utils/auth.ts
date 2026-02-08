import { db, memberships, users } from "@repo/db";
import { env } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import type { AuthContext } from "../context";
import { extractTokenFromHeader, verifyClerkToken } from "./token";

/**
 * Ensures authentication by using authPlugin context or manually verifying token
 * This is a fallback mechanism when authPlugin doesn't populate auth context reliably
 *
 * @param auth - Auth context from authPlugin (may be empty)
 * @param request - Request object to extract Authorization header
 * @returns Effective auth context with userId, or null if authentication fails
 */
export async function ensureAuth(
  auth: AuthContext | null | undefined,
  request: Request,
): Promise<AuthContext | null> {
  // If authPlugin already populated auth context, use it
  if (auth?.userId) {
    return auth;
  }

  // Fallback: manually verify token if authPlugin didn't populate auth
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return null;
  }

  try {
    const verified = await verifyClerkToken(token);
    return {
      userId: verified.userId,
      sessionId: verified.sessionId,
      orgId: verified.orgId,
      orgRole: verified.orgRole,
      orgSlug: verified.orgSlug,
      role: verified.role,
      claims: verified.claims,
    };
  } catch (_error) {
    // Token verification failed
    return null;
  }
}

/**
 * Requires authentication - throws Response if not authenticated
 *
 * @param auth - Auth context from ensureAuth
 * @returns AuthContext with userId (never null)
 * @throws Response with 401 status if not authenticated
 */
export type AuthenticatedContext = AuthContext & { userId: string };

export function requireAuth(auth: AuthContext | null): AuthenticatedContext {
  if (!auth?.userId) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return auth as AuthenticatedContext;
}

/**
 * Verifies that a user has access to a tenant (via membership)
 * In development mode, automatically creates user and membership if they don't exist
 *
 * @param userId - Clerk user ID (externalAuthId)
 * @param tenantId - Tenant ID to check access for
 * @returns true if user has membership, false otherwise
 */
export async function verifyTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  // Get user by externalAuthId (Clerk user ID)
  let [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.externalAuthId, userId))
    .limit(1);

  // In development, auto-create user if it doesn't exist
  if (!user && env.NODE_ENV === "development") {
    const [newUser] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        externalAuthId: userId,
      })
      .returning();
    user = newUser;
  }

  if (!user) {
    return false;
  }

  // Check if user has membership for this tenant
  let [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, user.id), eq(memberships.tenantId, tenantId)))
    .limit(1);

  // In development, auto-create membership if it doesn't exist
  if (!membership && env.NODE_ENV === "development") {
    const [newMembership] = await db
      .insert(memberships)
      .values({
        userId: user.id,
        tenantId: tenantId,
        role: "admin", // Default to admin in development
      })
      .returning();
    membership = newMembership;
  }

  return !!membership;
}
