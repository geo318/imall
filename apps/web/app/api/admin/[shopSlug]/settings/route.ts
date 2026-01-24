import { type NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/app/api/admin/utils";

const AUTH_ERROR_MESSAGE = "Authentication required. Please sign in to access admin features.";

async function handleBackendError(response: Response, fallback: string) {
  const errorText = await response.text();
  return NextResponse.json(
    { error: errorText || fallback },
    { status: response.status },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  try {
    const { shopSlug } = await params;
    const response = await backendRequest(`/admin/${shopSlug}/settings`);
    if (!response.ok) {
      return handleBackendError(response, "Failed to fetch shop settings");
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> },
) {
  try {
    const { shopSlug } = await params;
    const body = await request.json();
    const response = await backendRequest(`/admin/${shopSlug}/settings`, {
      method: "PATCH",
      body,
    });
    if (!response.ok) {
      return handleBackendError(response, "Failed to update shop settings");
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
