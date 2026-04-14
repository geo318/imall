import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";
import { type NextRequest, NextResponse } from "next/server";
import {
  CHECKOUT_INSTALLMENT_CART_KEY_COOKIE,
  CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE,
  CHECKOUT_INSTALLMENT_PAYMENT_TYPE_COOKIE,
  CHECKOUT_INSTALLMENT_PROVIDER_COOKIE,
  CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE,
  normalizeKeepzPersonalNumber,
  normalizeKeepzRedirectUrl,
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

function parseBackendErrorMessage(rawBody: string, fallbackMessage: string): string {
  if (!rawBody) return fallbackMessage;

  try {
    const parsed = JSON.parse(rawBody) as {
      error?: unknown;
      message?: unknown;
      code?: unknown;
      debug?: unknown;
    };
    const message =
      typeof parsed.error === "string"
        ? parsed.error
        : typeof parsed.message === "string"
          ? parsed.message
          : null;
    if (message?.trim()) {
      if (env.NODE_ENV === "development" && typeof parsed.message === "string") {
        const normalizedError = message.trim();
        if (parsed.debug) {
          return `${normalizedError} [debug available in API logs]`;
        }
        return normalizedError;
      }
      return message.trim();
    }
    if (parsed.code === "KEEPZ_NOT_CONFIGURED") {
      return "Keepz is not configured. Add Keepz/Credo RSA keys in .env and restart the API.";
    }
    return fallbackMessage;
  } catch {
    return rawBody.trim() || fallbackMessage;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cartId = searchParams.get("cartId")?.trim();
  const cartKey = searchParams.get("cartKey")?.trim();
  const paymentType = searchParams.get("paymentType")?.trim() === "card" ? "card" : "installments";
  const personalNumber = normalizeKeepzPersonalNumber(searchParams.get("personalNumber") || "");
  const isForeign = searchParams.get("isForeign")?.trim() === "true";
  const returnTo = searchParams.get("returnTo")?.trim() || null;

  if (!cartId || !cartKey) {
    return buildErrorRedirect(request, returnTo, "Missing checkout cart context.");
  }

  if (paymentType === "installments" && !personalNumber) {
    return buildErrorRedirect(
      request,
      returnTo,
      "Personal number is required for Keepz installment checkout.",
    );
  }

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
          provider: "keepz",
          paymentType,
          personalNumber: paymentType === "installments" ? personalNumber : undefined,
          isForeign: paymentType === "installments" ? isForeign : undefined,
        }),
        cache: "no-store",
      },
    );

    const rawBody = await response.text();
    if (!response.ok) {
      const parsedMessage = parseBackendErrorMessage(rawBody, "Failed to start Keepz checkout.");
      console.error("[checkout.keepz.launch] backend start failed", {
        cartId,
        paymentType,
        status: response.status,
        statusText: response.statusText,
        body: rawBody || null,
      });
      return buildErrorRedirect(request, returnTo, parsedMessage);
    }

    const parsed = JSON.parse(rawBody) as {
      orderCode?: string;
      redirectUrl?: string;
    };
    const orderCode = parsed.orderCode?.trim();
    const redirectUrl = parsed.redirectUrl ? normalizeKeepzRedirectUrl(parsed.redirectUrl) : "";

    if (!orderCode || !redirectUrl) {
      return buildErrorRedirect(request, returnTo, "Keepz redirect payload is incomplete.");
    }

    const redirectHost = (() => {
      try {
        return new URL(redirectUrl).hostname.toLowerCase();
      } catch {
        return "";
      }
    })();

    if (!redirectHost.endsWith("keepz.me")) {
      return buildErrorRedirect(request, returnTo, "Keepz redirect host is invalid.");
    }

    try {
      new URL(redirectUrl);
    } catch {
      return buildErrorRedirect(request, returnTo, "Keepz redirect URL is invalid.");
    }

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
    redirectResponse.cookies.set(
      CHECKOUT_INSTALLMENT_PROVIDER_COOKIE,
      encodeURIComponent("keepz"),
      cookieOptions,
    );
    redirectResponse.cookies.set(
      CHECKOUT_INSTALLMENT_PAYMENT_TYPE_COOKIE,
      encodeURIComponent(paymentType),
      cookieOptions,
    );

    return redirectResponse;
  } catch (error) {
    console.error("[checkout.keepz.launch] unexpected error", {
      cartId,
      paymentType,
      error: error instanceof Error ? error.message : String(error),
    });
    return buildErrorRedirect(request, returnTo, "Failed to launch Keepz checkout.");
  }
}
