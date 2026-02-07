"use client";

import { useEffect } from "react";

type Props = {
  productId: string;
};

/**
 * Client component that tracks product views
 * Only tracks once per page load
 * Uses localStorage to track unique views
 */
export function ProductViewTracker({ productId }: Props) {
  useEffect(() => {
    // Track view on mount (only once per page load)
    const trackView = async () => {
      try {
        if (typeof window === "undefined") {
          // Server-side: always count as unique (will be handled by backend logic)
          await fetch(`/api/products/${productId}/track-view`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isUnique: true }),
          });
          return;
        }

        // Use sessionStorage to track views per session
        // Each session counts as 1 unique view (even if user refreshes multiple times)
        const sessionKey = `product_view_session_${productId}`;
        const hasViewedThisSession = sessionStorage.getItem(sessionKey) !== null;

        // It's unique if this is the first view in this session
        const isUnique = !hasViewedThisSession;

        // Mark as viewed in this session (so subsequent views in same session aren't unique)
        if (isUnique) {
          sessionStorage.setItem(sessionKey, Date.now().toString());
        }

        await fetch(`/api/products/${productId}/track-view`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isUnique }),
        });
      } catch (error) {
        // Silently fail - view tracking is not critical
        console.error("[ProductViewTracker] Failed to track view:", error);
      }
    };

    trackView();
  }, [productId]);

  return null; // This component doesn't render anything
}
