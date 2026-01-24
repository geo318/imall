import { type NextRequest, NextResponse } from "next/server";
import { revalidateAllProducts, revalidateShop } from "@/lib/server/revalidate";
import { backendRequest } from "@/app/api/admin/utils";

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
