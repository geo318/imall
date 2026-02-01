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

const BUILD_PLACEHOLDER_KEY = "pk_build_placeholder";

export function ClerkProviderSlotClient({
  children,
  publishableKey,
}: {
  children: React.ReactNode;
  publishableKey: string;
}) {
  const [clerkReady, setClerkReady] = useState(false);

  // During Next.js build or when key is Docker placeholder, use "" so we still render ClerkProvider
  // (useUser etc. require it) but Clerk doesn't receive an invalid key
  const isBuildPlaceholder =
    publishableKey === BUILD_PLACEHOLDER_KEY ||
    (typeof process !== "undefined" && process.env?.NEXT_PHASE === "phase-production-build");
  const effectiveKey = isBuildPlaceholder ? "" : publishableKey;

  if (!effectiveKey) {
    return (
      <ClerkProvider publishableKey="">
        <ClerkReadyContext.Provider value={false}>{children}</ClerkReadyContext.Provider>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={effectiveKey}>
      <ClerkReadyDetector onReady={() => setClerkReady(true)} />
      <ClerkReadyContext.Provider value={clerkReady}>{children}</ClerkReadyContext.Provider>
    </ClerkProvider>
  );
}
