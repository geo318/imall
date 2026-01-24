import { type NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || `http://localhost:3001`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ productIdentifier: string }> },
) {
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
    });

    if (!response.ok) {
      // Silently fail - view tracking is not critical
      return NextResponse.json({ success: false }, { status: response.status });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (_error) {
    // Silently fail - view tracking is not critical
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
