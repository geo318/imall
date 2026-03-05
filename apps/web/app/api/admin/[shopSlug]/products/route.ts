import { type NextRequest, NextResponse } from "next/server";
import { revalidateAllProducts, revalidateShop } from "@/lib/server/revalidate";
import { backendRequest } from "@/app/api/admin/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  try {
    const { shopSlug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "active";
    const search = searchParams.get("search");
    const sort = searchParams.get("sort");
    const order = searchParams.get("order");

    const query = new URLSearchParams({ status });
    if (search) query.set("search", search);
    if (sort) query.set("sort", sort);
    if (order) query.set("order", order);

    const response = await backendRequest(`/admin/${shopSlug}/products?${query.toString()}`);

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
