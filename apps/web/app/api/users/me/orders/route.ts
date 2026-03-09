import { NextResponse } from "next/server";
import { backendRequest } from "@/app/api/admin/utils";

const AUTH_ERROR_MESSAGE = "Authentication required. Please sign in to view your orders.";

async function handleBackendError(response: Response, fallback: string) {
  const raw = await response.text();
  if (!raw) {
    return NextResponse.json({ error: fallback }, { status: response.status });
  }

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    return NextResponse.json(
      { error: parsed.error || parsed.message || fallback },
      { status: response.status },
    );
  } catch {
    return NextResponse.json({ error: raw || fallback }, { status: response.status });
  }
}

export async function GET() {
  try {
    const response = await backendRequest("/users/me/orders");
    if (!response.ok) {
      return await handleBackendError(response, "Failed to load orders");
    }

    const data = await response.json();
    return NextResponse.json(data, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json({ error: AUTH_ERROR_MESSAGE }, { status: 401 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
