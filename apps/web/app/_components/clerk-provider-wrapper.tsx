"use client";

import { useEffect, useState } from "react";
import { ClerkProviderSlotClient } from "./clerk-provider-slot-client";

// Client component wrapper - reads env only after mount
// This avoids "uncached data" errors during build/SSR
export function ClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState<string>("");

  useEffect(() => {
    // Only read env after mount to avoid "uncached data" errors during build
    // Ignore Docker build placeholder so we never pass it to Clerk
    const raw = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
    setPublishableKey(raw === "pk_build_placeholder" ? "" : raw);
  }, []);

  // During SSR/build, render without ClerkProvider to avoid errors
  // After mount, ClerkProvider will be available
  return (
    <ClerkProviderSlotClient publishableKey={publishableKey}>{children}</ClerkProviderSlotClient>
  );
}
