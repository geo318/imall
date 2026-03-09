import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { defaultLocale, type Locale, locales } from "@/i18n/config";
import { isReservedRoute } from "@/lib/utils";

function stripLocale(pathname: string) {
  const localePattern = new RegExp(`^/(${locales.join("|")})(?=/|$)`);
  return pathname.replace(localePattern, "");
}

function getLocaleFromPath(pathname: string): Locale | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (segment && locales.includes(segment as Locale)) {
    return segment as Locale;
  }
  return null;
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip locale/auth middleware for public static assets (e.g. /imall-logo.png)
  // so Next can serve files from /public directly.
  if (/\.[^/]+$/.test(pathname)) {
    return NextResponse.next();
  }

  const detectedLocale = getLocaleFromPath(pathname);
  if (!detectedLocale) {
    const url = req.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-locale", detectedLocale);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.cookies.set("NEXT_LOCALE", detectedLocale, { path: "/" });

  // App Router can issue non-GET requests (e.g. internal RSC/action posts) to
  // page URLs. Keep locale/cookie enrichment but skip auth/route gating here
  // to avoid turning internal navigations into 500s in dev.
  if (req.method !== "GET" && req.method !== "HEAD") {
    return response;
  }

  const authResult = await auth();
  const normalizedPath = stripLocale(pathname) || "/";

  const slug = normalizedPath.split("/").find(Boolean);
  if (slug && isReservedRoute(slug)) {
    return response;
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  const isPublicRoute =
    normalizedPath === "/" ||
    normalizedPath.startsWith("/sign-in") ||
    normalizedPath.startsWith("/sign-up") ||
    normalizedPath.startsWith("/sso-callback") ||
    normalizedPath.startsWith("/sell") ||
    normalizedPath.startsWith("/superadmin") ||
    normalizedPath === "/favicon.ico" ||
    segments.length === 1;

  if (isPublicRoute) return response;

  if (!authResult.userId) {
    return authResult.redirectToSignIn();
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|_next/webpack-hmr|__nextjs_original-stack-frame|favicon.ico|.*\\..*).*)",
    "/",
  ],
};
