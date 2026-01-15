import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isReservedRoute } from "@/lib/utils";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/:slug",
  "/favicon.ico",
]);

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  // Skip reserved route check for API routes (revalidate, etc.)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Reserved routes should be handled by their specific routes, not the catchall [slug]
  // Let them through to be handled by Next.js routing
  const slug = pathname.split("/").find(Boolean);
  if (slug && isReservedRoute(slug)) {
    // Let Next.js handle reserved routes (like /cart, /checkout, etc.)
    return NextResponse.next();
  }

  if (isPublicRoute(req)) return NextResponse.next();

  const authResult = await auth();
  if (!authResult.userId) {
    return authResult.redirectToSignIn();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|_next/webpack-hmr|__nextjs_original-stack-frame|favicon.ico).*)",
    "/",
  ],
};
