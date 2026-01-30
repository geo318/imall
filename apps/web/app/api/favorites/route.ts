import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBackendBase } from "../_utils/backend";

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

async function backendRequest(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
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
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  return response;
}

export async function GET(_request: NextRequest) {
  try {
    const response = await backendRequest("/favorites");

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        const errorText = await response.text();
        errorData = { error: errorText || "Failed to fetch favorites" };
      }
      console.error("[Favorites API] Backend error:", response.status, errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Favorites API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";

    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json(
        {
          error: "Authentication required. Please sign in to access favorites.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
