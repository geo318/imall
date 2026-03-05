import { type NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/app/api/admin/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  const { shopSlug } = await params;

  try {
    const formData = await request.formData();
    const response = await backendRequest(`/admin/${shopSlug}/upload/image`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to upload image" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
