import { env } from "@repo/shared";
import { type NextRequest, NextResponse } from "next/server";

// Forwards the ad-hoc Credo installment request to the backend. The password is
// re-checked here for fast feedback, then again by the backend as the source of
// truth. Never expose CUSTOM_CHECKOUT_PASS to the client.
export async function POST(request: NextRequest) {
  const expectedPass = env.CUSTOM_CHECKOUT_PASS?.trim();
  if (!expectedPass) {
    return NextResponse.json({ error: "Custom checkout is not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pass =
    typeof (body as { pass?: unknown })?.pass === "string" ? (body as { pass: string }).pass : "";
  if (pass !== expectedPass) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  try {
    const response = await fetch(`${env.BACKEND_URL}/custom-checkout/credo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const rawBody = await response.text();
    const parsed = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    return NextResponse.json(parsed, { status: response.status });
  } catch (error) {
    console.error("[custom-checkout.credo] forward failed", error);
    return NextResponse.json({ error: "Failed to reach checkout backend" }, { status: 502 });
  }
}
