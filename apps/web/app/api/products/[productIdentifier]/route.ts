import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBackendBase } from "../../_utils/backend";

const API_BASE = resolveBackendBase();

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productIdentifier: string }> },
) {
  try {
    const { productIdentifier } = await params;
    const token = await getAuthToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/api/products/${productIdentifier}`, {
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Products API] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to fetch product" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Products API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
