import { auth } from "@clerk/nextjs/server";
import { env } from "@repo/shared";
import { type NextRequest, NextResponse } from "next/server";
import {
  CHECKOUT_INSTALLMENT_CART_KEY_COOKIE,
  CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE,
  CHECKOUT_INSTALLMENT_PAYMENT_TYPE_COOKIE,
  CHECKOUT_INSTALLMENT_PROVIDER_COOKIE,
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

function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol =
    forwardedProto ||
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : request.nextUrl.protocol.replace(":", "") || "https");

  return `${protocol}://${host}`;
}

function normalizeReturnPath(returnTo: string | null): string {
  if (!returnTo) return "/";
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return "/";
}

function buildErrorRedirect(request: NextRequest, returnTo: string | null, message: string) {
  const fallbackUrl = new URL(normalizeReturnPath(returnTo), getRequestOrigin(request));
  fallbackUrl.searchParams.set("installment_error", message);
  return NextResponse.redirect(fallbackUrl);
}

function parseBackendErrorMessage(rawBody: string, fallbackMessage: string): string {
  if (!rawBody) return fallbackMessage;

  try {
    const parsed = JSON.parse(rawBody) as { error?: unknown; message?: unknown };
    const error = typeof parsed.error === "string" ? parsed.error.trim() : "";
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    if (error.startsWith("Failed to ") && message) return message;
    return error || message || fallbackMessage;
  } catch {
    return rawBody.trim() || fallbackMessage;
  }
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

  if (!clientFullName || !mobile || !email || !factAddress) {
    return buildErrorRedirect(request, returnTo, "Credo customer details are incomplete.");
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
    paymentType: "installments",
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
          provider: "credo",
          paymentType: "installments",
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
      const parsedMessage = parseBackendErrorMessage(
        rawBody,
        "Failed to start Credo installments.",
      );
      console.error("[checkout.installments.launch] backend start failed", {
        cartId,
        mode,
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

    if (redirectHost !== "credo.ge" && !redirectHost.endsWith(".credo.ge")) {
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
    redirectResponse.cookies.set(
      CHECKOUT_INSTALLMENT_PROVIDER_COOKIE,
      encodeURIComponent("credo"),
      cookieOptions,
    );
    redirectResponse.cookies.set(
      CHECKOUT_INSTALLMENT_PAYMENT_TYPE_COOKIE,
      encodeURIComponent("installments"),
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
