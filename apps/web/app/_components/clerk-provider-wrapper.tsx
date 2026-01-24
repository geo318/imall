"use client";

import { useEffect, useState } from "react";
import { ClerkProviderSlotClient } from "./clerk-provider-slot-client";

// Client component wrapper - reads env only after mount
// This avoids "uncached data" errors during build/SSR
export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState<string>("");

  useEffect(() => {
    // Only read env after mount to avoid "uncached data" errors during build
    // NEXT_PUBLIC_ vars are injected by Next.js and available in the browser
    setPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "");
  }, []);

  // During SSR/build, render without ClerkProvider to avoid errors
  // After mount, ClerkProvider will be available
  return (
    <ClerkProviderSlotClient publishableKey={publishableKey}>{children}</ClerkProviderSlotClient>
  );
}
