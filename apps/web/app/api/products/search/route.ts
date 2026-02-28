import { type NextRequest, NextResponse } from "next/server";
import { resolveBackendBase } from "../../_utils/backend";

const API_BASE = resolveBackendBase();

export async function GET(request: NextRequest) {
  try {
    const backendUrl = new URL(`${API_BASE}/api/products/search`);
    request.nextUrl.searchParams.forEach((value, key) => {
      backendUrl.searchParams.set(key, value);
    });

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 30 },
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control":
          response.headers.get("cache-control") ??
          "public, max-age=30, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[Products Search API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

