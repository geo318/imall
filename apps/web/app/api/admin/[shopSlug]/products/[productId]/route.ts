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
      } catch (_fallbackError) {
        // Silently fail - will return null
      }
    }

    return token;
  } catch (_error) {
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

  const response = await fetch(`${API_BASE}/api${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return response;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; productId: string }> },
) {
  try {
    const { shopSlug, productId } = await params;
    const response = await backendRequest(`/admin/${shopSlug}/products/${productId}`);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to fetch product" },
        { status: response.status },
      );
    }

    const data = await response.json();
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; productId: string }> },
) {
  try {
    const { shopSlug, productId } = await params;
    const body = await request.json();
    const response = await backendRequest(`/admin/${shopSlug}/products/${productId}`, {
      method: "PUT",
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to update product" },
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; productId: string }> },
) {
  try {
    const { shopSlug, productId } = await params;
    const response = await backendRequest(`/admin/${shopSlug}/products/${productId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to delete product" },
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
