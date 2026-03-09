import { type NextRequest, NextResponse } from "next/server";
import { resolveBackendBase } from "../../../_utils/backend";

const API_BASE = resolveBackendBase();
const TRACK_VIEW_PROXY_TIMEOUT_MS = 2_500;

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productIdentifier: string }> },
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TRACK_VIEW_PROXY_TIMEOUT_MS);

  try {
    const { productIdentifier: productId } = await params;

    // Parse request body to get isUnique flag
    let body: { isUnique?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // If body parsing fails, use default
      body = { isUnique: false };
    }

    // Call backend to track view (productId can be UUID or product identifier)
    const response = await fetch(`${API_BASE}/api/products/${productId}/track-view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // Track-view failures should never affect page UX, keep this endpoint best-effort.
    return NextResponse.json({ success: response.ok }, { status: 200 });
  } catch (error) {
    if (isAbortError(error)) {
      return NextResponse.json({ success: false, timeout: true }, { status: 200 });
    }
    // Silently fail - view tracking is not critical
    return NextResponse.json({ success: false }, { status: 200 });
  } finally {
    clearTimeout(timeoutId);
  }
}
