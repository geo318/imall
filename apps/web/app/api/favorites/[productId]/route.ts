import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || `http://localhost:3001`;

async function getAuthToken(): Promise<string | null> {
  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return null;
    }
    let token = await authResult.getToken();
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
    method?: "GET" | "POST" | "DELETE";
  } = {},
) {
  const token = await getAuthToken();

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
  });

  return response;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await params;
    const response = await backendRequest(`/favorites/${productId}`, {
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Favorites API] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to add favorite" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Favorites API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in to add favorites." },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await params;
    const response = await backendRequest(`/favorites/${productId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Favorites API] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to remove favorite" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Favorites API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json(
        {
          error: "Authentication required. Please sign in to remove favorites.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await params;
    const response = await backendRequest(`/favorites/check/${productId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Favorites API] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to check favorite" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Favorites API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json({ isFavorited: false }, { status: 200 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
