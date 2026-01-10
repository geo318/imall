"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "./query-provider";

export function LayoutClient({ children }: Readonly<{ children: React.ReactNode }>) {
  // Use process.env directly for NEXT_PUBLIC_ vars in client components
  // This avoids blocking navigation as these are inlined at build time
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    console.error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set");
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <QueryProvider>{children}</QueryProvider>
      <Toaster />
    </ClerkProvider>
  );
}
