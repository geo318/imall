"use client";

import { ClerkProvider, useClerk } from "@clerk/nextjs";
import { createContext, useContext, useEffect, useState } from "react";

// Create ClerkReadyContext to track when Clerk is fully initialized
const ClerkReadyContext = createContext<boolean>(false);

export function useClerkReady() {
  const contextValue = useContext(ClerkReadyContext);
  // During SSR/build, Clerk context won't be available, so return false
  if (typeof window === "undefined") {
    return false;
  }
  return contextValue;
}

function ClerkReadyDetector({ onReady }: { onReady: () => void }) {
  const clerk = useClerk();
  useEffect(() => {
    // Clerk is available when useClerk returns a value
    // Use requestAnimationFrame to ensure ClerkProvider is fully initialized
    if (clerk) {
      // Use double requestAnimationFrame to ensure Clerk is fully ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onReady();
        });
      });
    }
  }, [clerk, onReady]);
  return null;
}

export function ClerkProviderSlotClient({
  children,
  publishableKey,
}: {
  children: React.ReactNode;
  publishableKey: string;
}) {
  const [clerkReady, setClerkReady] = useState(false);

  // Always render ClerkProvider to avoid "useUser outside ClerkProvider" errors
  // ClerkProvider handles empty keys gracefully during SSR
  // The key will be available after mount
  if (!publishableKey) {
    // During SSR when key isn't available yet, still render ClerkProvider with empty key
    // This prevents "useUser outside ClerkProvider" errors
    return (
      <ClerkProvider publishableKey="">
        <ClerkReadyContext.Provider value={false}>{children}</ClerkReadyContext.Provider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkReadyDetector onReady={() => setClerkReady(true)} />
      <ClerkReadyContext.Provider value={clerkReady}>{children}</ClerkReadyContext.Provider>
    </ClerkProvider>
  );
}
