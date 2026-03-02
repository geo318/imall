"use client";

import { Footer } from "@/components/footer/footer";
import { locales } from "@/i18n/config";
import { usePathname } from "@/i18n/navigation.client";

/**
 * Layout wrapper that conditionally renders Header/Footer
 * Excludes them from auth pages which have their own layout
 */
type LayoutWrapperProps = Readonly<{
  children: React.ReactNode;
  header: React.ReactNode;
}>;

export function LayoutWrapper({ children, header }: LayoutWrapperProps) {
  const pathname = usePathname();
  const localePattern = new RegExp(`^/(${locales.join("|")})(?=/|$)`);
  const normalizedPath = pathname ? pathname.replace(localePattern, "") : "";
  const isAuthPage =
    normalizedPath.startsWith("/sign-in") ||
    normalizedPath.startsWith("/sign-up") ||
    normalizedPath.startsWith("/sso-callback") ||
    normalizedPath.startsWith("/superadmin") ||
    false;

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {header}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
