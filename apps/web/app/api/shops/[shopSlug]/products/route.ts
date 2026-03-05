import { type NextRequest, NextResponse } from "next/server";
import { CACHE_TAGS } from "@/lib/constants";
import { resolveBackendBase } from "../../../_utils/backend";

const API_BASE = resolveBackendBase();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  try {
    const { shopSlug } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Forward all query parameters to the backend
    const backendUrl = new URL(`${API_BASE}/api/shops/${shopSlug}/products`);
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.set(key, value);
    });

    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: {
        revalidate: 30,
        tags: [CACHE_TAGS.PRODUCTS, `${CACHE_TAGS.SHOP}-${shopSlug}`],
      },
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
    console.error("[Shop Products API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
