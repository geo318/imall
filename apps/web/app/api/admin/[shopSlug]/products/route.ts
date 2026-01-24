import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { revalidateAllProducts, revalidateShop } from "@/lib/server/revalidate";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || `http://localhost:3001`;

async function getAuthToken(): Promise<string | null> {
  try {
    const authResult = await auth();

    if (!authResult.userId) {
      return null;
    }

    // Try to get the session token
    let token = await authResult.getToken();

    // Fallback to integration_fallback template if session token not available
    if (!token) {
      try {
        token = await authResult.getToken({
          template: "integration_fallback",
        });
      } catch {
        // Silently fail - will return null
      }
    }

    return token;
  } catch {
    return null;
  }
}

async function backendRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  } = {},
) {
  const token = await getAuthToken();

  // Admin routes require authentication
  if (!token) {
    throw new Error("Unauthorized: Authentication required");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const url = `${API_BASE}/api${path}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  try {
    const { shopSlug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "active";
    const response = await backendRequest(`/admin/${shopSlug}/products?status=${status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Admin Products API] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to fetch products" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Admin Products API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    // Handle authentication errors
    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json(
        {
          error: "Authentication required. Please sign in to access admin features.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  try {
    const { shopSlug } = await params;
    const body = await request.json();
    const response = await backendRequest(`/admin/${shopSlug}/products`, {
      method: "POST",
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to create product" },
        { status: response.status },
      );
    }

    const data = await response.json();
    revalidateAllProducts();
    revalidateShop(shopSlug);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json(
        {
          error: "Authentication required. Please sign in to access admin features.",
        },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
