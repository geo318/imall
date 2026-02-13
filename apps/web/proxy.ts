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
    "/((?!_next/static|_next/image|_next/data|_next/webpack-hmr|__nextjs_original-stack-frame|favicon.ico).*)",
    "/",
  ],
};
