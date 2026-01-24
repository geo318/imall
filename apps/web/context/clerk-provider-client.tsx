"use client";

import { ClerkProvider, useClerk } from "@clerk/nextjs";
import { createContext, useContext, useEffect, useState } from "react";

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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onReady();
        });
      });
    }
  }, [clerk, onReady]);
  return null;
}

export function ClerkContextProvider({
  publishableKey,
  children,
}: {
  publishableKey: string | undefined;
  children: React.ReactNode;
}) {
  const [clerkReady, setClerkReady] = useState(false);

  if (!publishableKey) {
    // During build or when key is missing, render children without ClerkProvider
    // This prevents build errors when Clerk key isn't available
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkReadyDetector onReady={() => setClerkReady(true)} />
      <ClerkReadyContext.Provider value={clerkReady}>{children}</ClerkReadyContext.Provider>
    </ClerkProvider>
  );
}
