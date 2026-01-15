import { verifyToken } from "@clerk/backend";
import { env } from "@repo/shared";

/**
 * Extracts and validates a JWT token from an Authorization header
 * Handles malformed tokens (duplicated, extra whitespace, etc.)
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  let token = authHeader.substring(7).trim();

  // Remove any extra whitespace/newlines
  token = token.replaceAll(/\s+/g, " ").trim();

  // Split token into parts
  const tokenParts = token.split(".");

  // A valid JWT has exactly 3 parts: header.payload.signature
  if (tokenParts.length === 3) {
    return token;
  }

  // If token has more than 3 parts, it might be duplicated
  // Extract the first valid JWT (first 3 parts)
  if (tokenParts.length > 3) {
    console.warn("[Token] Token has more than 3 parts, extracting first JWT");
    return tokenParts.slice(0, 3).join(".");
  }

  // Invalid token structure
  console.error("[Token] Invalid token structure:", {
    partsCount: tokenParts.length,
    tokenLength: token.length,
  });

  return null;
}

export type VerifiedTokenData = {
  userId: string;
  sessionId: string;
  orgId: string | null;
  orgRole: string | null;
  orgSlug: string | null;
  role: "admin" | "staff" | "viewer" | undefined;
  claims: Record<string, unknown>;
};

/**
 * Verifies a Clerk JWT token and extracts user information
 */
export async function verifyClerkToken(token: string): Promise<VerifiedTokenData> {
  try {
    const verifiedToken = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_PUBLIC_KEY,
      clockSkewInMs: 60_000, // Tolerate 60s clock skew
    });

    return {
      userId: verifiedToken.sub,
      sessionId: verifiedToken.sid,
      orgId: verifiedToken.org_id ?? null,
      orgRole: verifiedToken.org_role ?? null,
      orgSlug: verifiedToken.org_slug ?? null,
      role: verifiedToken.role as "admin" | "staff" | "viewer" | undefined,
      claims: verifiedToken as Record<string, unknown>,
    };
  } catch (error) {
    if (env.NODE_ENV === "development") {
      console.error("[Token] Verification failed:", {
        error: error instanceof Error ? error.message : String(error),
        tokenLength: token.length,
      });
    }
    throw error;
  }
}
