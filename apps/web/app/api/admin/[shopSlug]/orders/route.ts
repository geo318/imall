import { type NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/app/api/admin/utils";

const AUTH_ERROR_MESSAGE = "Authentication required. Please sign in to access admin features.";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  try {
    const { shopSlug } = await params;
    const response = await backendRequest(`/admin/${shopSlug}/orders`);
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: errorText || "Failed to fetch orders",
      }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json({ error: AUTH_ERROR_MESSAGE }, { status: 401 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
