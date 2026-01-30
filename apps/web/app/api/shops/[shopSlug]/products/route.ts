import { type NextRequest, NextResponse } from "next/server";
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Shop Products API] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to fetch products" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Shop Products API] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
