import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { resolveBackendBase } from "../../_utils/backend";

const API_BASE = resolveBackendBase();
const PROXY_TIMEOUT_MS = 8_000;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

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
      cache: "no-store",
      signal: controller.signal,
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": response.headers.get("cache-control") ?? "no-store",
      },
    });
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[Products API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    clearTimeout(timeoutId);
  }
}
