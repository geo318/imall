import { type NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/app/api/admin/utils";

const AUTH_ERROR_MESSAGE = "Authentication required. Please sign in to access admin features.";

async function handleBackendError(response: Response, fallback: string) {
  const errorText = await response.text();
  return NextResponse.json({ error: errorText || fallback }, { status: response.status });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; optionId: string }> },
) {
  try {
    const { shopSlug, optionId } = await params;
    const body = await request.json();
    const response = await backendRequest(`/admin/${shopSlug}/variant-options/${optionId}`, {
      method: "PUT",
      body,
    });
    if (!response.ok) {
      return handleBackendError(response, "Failed to update variant option");
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; optionId: string }> },
) {
  try {
    const { shopSlug, optionId } = await params;
    const response = await backendRequest(`/admin/${shopSlug}/variant-options/${optionId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      return handleBackendError(response, "Failed to delete variant option");
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
