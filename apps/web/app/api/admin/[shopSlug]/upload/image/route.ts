import { type NextRequest, NextResponse } from "next/server";
import { getAdminToken } from "@/app/api/admin/utils";
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || `http://localhost:3001`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  const { shopSlug } = await params;
  const token = await getAdminToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get FormData from request
    const formData = await request.formData();

    // Forward FormData directly to backend - don't set Content-Type header
    // The browser/fetch will automatically set it with the correct boundary
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE}/api/admin/${shopSlug}/upload/image`, {
      method: "POST",
      headers,
      body: formData, // FormData is forwarded as-is
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Image Upload] Backend error:", response.status, errorText);
      return NextResponse.json(
        { error: errorText || "Failed to upload image" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[Image Upload] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
