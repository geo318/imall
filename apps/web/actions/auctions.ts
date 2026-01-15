"use server";

import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";

/**
 * Helper to get Clerk token for backend requests
 */
async function getAuthToken(): Promise<string | null> {
  try {
    console.log("[Server Action] getAuthToken - Starting token retrieval");
    const authResult = await auth();

    console.log("[Server Action] getAuthToken - Auth result:", {
      hasAuthResult: !!authResult,
      userId: authResult?.userId,
      hasUserId: !!authResult?.userId,
    });

    if (!authResult.userId) {
      console.warn("[Server Action] getAuthToken - No userId in auth result");
      return null;
    }

    // Try to get the session token
    console.log("[Server Action] getAuthToken - Attempting to get token");
    let token = await authResult.getToken();

    console.log("[Server Action] getAuthToken - Token from getToken():", {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 30),
    });

    // Fallback to integration_fallback template if session token not available
    if (!token) {
      console.log("[Server Action] getAuthToken - Trying integration_fallback template");
      try {
        token = await authResult.getToken({
          template: "integration_fallback",
        });
        console.log("[Server Action] getAuthToken - Token from integration_fallback:", {
          hasToken: !!token,
          tokenLength: token?.length,
          tokenPrefix: token?.substring(0, 30),
        });
      } catch (fallbackError) {
        console.error("[Server Action] getAuthToken - integration_fallback failed:", {
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }
    }

    if (!token) {
      console.error("[Server Action] getAuthToken - No token available after all attempts");
    } else {
      console.log("[Server Action] getAuthToken - Token successfully retrieved");
    }

    return token;
  } catch (error) {
    console.error("[Server Action] getAuthToken - Exception:", {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
}

/**
 * Helper to make authenticated backend requests
 */
async function backendRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    token?: string | null;
  } = {},
): Promise<Response> {
  // Use provided token or get from server-side auth
  const token = options.token ?? (await getAuthToken());
  const url = `${env.BACKEND_URL}/api${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    // Only set Authorization header (standard HTTP header name)
    // Setting both 'authorization' and 'Authorization' can cause header concatenation issues
    headers["Authorization"] = `Bearer ${token}`;
    console.log("[Server Action] backendRequest - Token added to headers:", {
      hasToken: true,
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 30),
      authorizationHeader: headers["authorization"]?.substring(0, 40),
      AuthorizationHeader: headers["Authorization"]?.substring(0, 40),
    });
  } else {
    console.error("[Server Action] backendRequest - No token available:", {
      path,
      method: options.method || "GET",
      url,
    });
  }

  console.log("[Server Action] backendRequest - Request details:", {
    url,
    method: options.method || "GET",
    hasBody: !!options.body,
    headers: {
      "Content-Type": headers["Content-Type"],
      Authorization: headers.Authorization
        ? `${headers.Authorization.substring(0, 30)}...`
        : "none",
    },
  });

  // Verify headers before sending
  console.log("[Server Action] backendRequest - Final headers being sent:", {
    "Content-Type": headers["Content-Type"],
    Authorization: headers.Authorization ? "Bearer [token]" : "MISSING",
    allHeaderKeys: Object.keys(headers),
  });

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  console.log("[Server Action] backendRequest - Response received:", {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  return response;
}

/**
 * Place a bid on an auction
 * shopSlug is extracted from product data, so caller doesn't need to pass it
 * @param shopSlug - The shop slug (extracted from product.tenantSlug)
 * @param auctionId - The auction ID
 * @param amount - The bid amount
 * @param token - Optional Clerk token (if provided, will be used instead of server-side auth)
 */
export async function placeBid(
  shopSlug: string,
  auctionId: string,
  amount: string | number,
  token?: string | null,
): Promise<void> {
  try {
    console.log("[Server Action] placeBid called:", {
      shopSlug,
      auctionId,
      amount,
      amountType: typeof amount,
      hasTokenParam: token !== undefined && token !== null,
      timestamp: new Date().toISOString(),
    });

    // Use provided token or get from server-side auth
    let authToken = token ?? null;
    if (authToken === null) {
      authToken = await getAuthToken();
      console.log("[Server Action] Auth token from server-side auth:", {
        hasToken: authToken !== null,
        tokenLength: authToken?.length,
        tokenPrefix: authToken?.substring(0, 20),
      });
    } else {
      console.log("[Server Action] Auth token provided from client:", {
        hasToken: true,
        tokenLength: authToken.length,
        tokenPrefix: authToken.substring(0, 20),
      });
    }

    if (authToken === null) {
      console.error("[Server Action] No auth token available");
      throw new Error("You must be signed in to place a bid");
    }

    const backendUrl = `${env.BACKEND_URL}/api/shops/${shopSlug}/auctions/${auctionId}/bids`;
    const requestBody = { amount: String(amount) };

    console.log("[Server Action] Making backend request:", {
      url: backendUrl,
      method: "POST",
      body: requestBody,
      backendUrl: env.BACKEND_URL,
    });

    let response: Response;
    try {
      response = await backendRequest(`/shops/${shopSlug}/auctions/${auctionId}/bids`, {
        method: "POST",
        body: requestBody,
        token: authToken,
      });

      console.log("[Server Action] Backend response received:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });
    } catch (error) {
      console.error("[Server Action] Backend request failed:", {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        shopSlug,
        auctionId,
        amount,
        backendUrl: env.BACKEND_URL,
      });
      throw new Error(
        `Failed to connect to backend: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      let errorData: string;
      try {
        errorData = await response.text();
        console.error("[Server Action] Backend error response:", {
          status: response.status,
          statusText: response.statusText,
          errorData,
          shopSlug,
          auctionId,
          amount,
        });
      } catch (textError) {
        console.error("[Server Action] Failed to read error response:", {
          status: response.status,
          statusText: response.statusText,
          textError: textError instanceof Error ? textError.message : String(textError),
        });
        errorData = `HTTP ${response.status}: ${response.statusText}`;
      }

      let errorMessage = "Failed to place bid";

      try {
        const parsed = JSON.parse(errorData);
        errorMessage = parsed.error || parsed.message || errorMessage;
      } catch {
        errorMessage = errorData || errorMessage;
      }

      if (response.status === 401) {
        console.error("[Server Action] Authentication failed");
        throw new Error("You must be signed in to place a bid");
      }
      if (response.status === 403) {
        console.error("[Server Action] Permission denied");
        throw new Error("You don't have permission to place a bid");
      }

      console.error("[Server Action] Bid placement failed:", {
        status: response.status,
        errorMessage,
      });
      throw new Error(errorMessage);
    }

    console.log("[Server Action] Bid placed successfully:", {
      shopSlug,
      auctionId,
      amount,
    });
  } catch (error) {
    // Top-level error handler to catch any unexpected errors
    console.error("[Server Action] placeBid unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
      errorStack: error instanceof Error ? error.stack : undefined,
      shopSlug,
      auctionId,
      amount,
      timestamp: new Date().toISOString(),
    });
    throw error; // Re-throw to maintain error behavior
  }
}
