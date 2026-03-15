import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";
import { type NextRequest, NextResponse } from "next/server";
import {
  CHECKOUT_INSTALLMENT_CART_KEY_COOKIE,
  CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE,
  CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE,
  normalizeCredoRedirectUrl,
} from "@/components/checkout/credo-launch";

async function getAuthToken(): Promise<string | null> {
  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return null;
    }

    let token = await authResult.getToken();
    if (!token) {
      try {
        token = await authResult.getToken({
          template: "integration_fallback",
        });
      } catch {
        // Token not available
      }
    }

    return token;
  } catch {
    return null;
  }
}

function buildErrorRedirect(request: NextRequest, returnTo: string | null, message: string) {
  const fallbackUrl = new URL(returnTo || "/", request.nextUrl.origin);
  fallbackUrl.searchParams.set("installment_error", message);
  return NextResponse.redirect(fallbackUrl);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cartId = searchParams.get("cartId")?.trim();
  const cartKey = searchParams.get("cartKey")?.trim();
  const mode = searchParams.get("mode")?.trim() || "server-form";
  const installmentLength = Number(searchParams.get("installmentLength") || 12);
  const clientFullName = searchParams.get("clientFullName")?.trim() || undefined;
  const mobile = searchParams.get("mobile")?.trim() || undefined;
  const email = searchParams.get("email")?.trim() || undefined;
  const factAddress = searchParams.get("factAddress")?.trim() || undefined;
  const returnTo = searchParams.get("returnTo")?.trim() || null;

  if (!cartId || !cartKey) {
    return buildErrorRedirect(request, returnTo, "Missing installment cart context.");
  }

  console.info("[checkout.installments.launch] start", {
    cartId,
    cartKey,
    mode,
    hasClientFullName: Boolean(clientFullName),
    hasMobile: Boolean(mobile),
    hasEmail: Boolean(email),
    hasFactAddress: Boolean(factAddress),
    installmentLength,
  });

  try {
    const token = await getAuthToken();
    const response = await fetch(
      `${env.BACKEND_URL}/api/carts/${cartId}/checkout/installments/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          installmentLength,
          clientFullName,
          mobile,
          email,
          factAddress,
        }),
        cache: "no-store",
      },
    );

    const rawBody = await response.text();
    if (!response.ok) {
      console.error("[checkout.installments.launch] backend start failed", {
        cartId,
        mode,
        status: response.status,
        statusText: response.statusText,
        body: rawBody || null,
      });
      return buildErrorRedirect(request, returnTo, "Failed to start Credo installments.");
    }

    const parsed = JSON.parse(rawBody) as {
      orderCode?: string;
      redirectUrl?: string;
    };
    const orderCode = parsed.orderCode?.trim();
    const redirectUrl = parsed.redirectUrl ? normalizeCredoRedirectUrl(parsed.redirectUrl) : "";

    if (!orderCode || !redirectUrl) {
      console.error("[checkout.installments.launch] missing redirect payload", {
        cartId,
        mode,
        body: parsed,
      });
      return buildErrorRedirect(request, returnTo, "Credo redirect payload is incomplete.");
    }

    const redirectHost = (() => {
      try {
        return new URL(redirectUrl).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();

    if (!redirectHost.endsWith("credo.ge")) {
      console.error("[checkout.installments.launch] unexpected redirect host", {
        cartId,
        mode,
        redirectUrl,
        redirectHost,
      });
      return buildErrorRedirect(request, returnTo, "Credo redirect host is invalid.");
    }

    console.info("[checkout.installments.launch] redirecting", {
      cartId,
      cartKey,
      mode,
      orderCode,
      redirectUrl,
      redirectHost,
    });

    const redirectResponse = NextResponse.redirect(redirectUrl);
    const cookieOptions = {
      path: "/",
      sameSite: "lax" as const,
      httpOnly: false,
      secure: env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
    };

    redirectResponse.cookies.set(
      CHECKOUT_INSTALLMENT_CART_KEY_COOKIE,
      encodeURIComponent(cartKey),
      cookieOptions,
    );
    redirectResponse.cookies.set(
      CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE,
      encodeURIComponent(orderCode),
      cookieOptions,
    );
    redirectResponse.cookies.set(
      CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE,
      encodeURIComponent(redirectUrl),
      cookieOptions,
    );

    return redirectResponse;
  } catch (error) {
    console.error("[checkout.installments.launch] failed", {
      cartId,
      cartKey,
      mode,
      error,
    });
    return buildErrorRedirect(request, returnTo, "Failed to launch Credo installments.");
  }
}
