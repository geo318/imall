"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Footer } from "@/components/footer/footer";
import { HeaderClient } from "@/components/header-client";

/**
 * Layout wrapper that conditionally renders Header/Footer
 * Excludes them from auth pages which have their own layout
 */
export function LayoutWrapper({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/sign-in") || pathname?.startsWith("/sign-up") || false;

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<div className="h-16 border-b border-border bg-slate-50" />}>
        <HeaderClient />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
