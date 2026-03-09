"use client";

import { useEffect } from "react";

type Props = {
  productId: string;
};

const TRACK_VIEW_TIMEOUT_MS = 3_000;

/**
 * Client component that tracks product views
 * Only tracks once per page load
 * Uses localStorage to track unique views
 */
export function ProductViewTracker({ productId }: Props) {
  useEffect(() => {
    if (!productId) {
      return;
    }

    // Track view on mount (only once per page load)
    const trackView = async () => {
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

      const endpoint = `/api/products/${encodeURIComponent(productId)}/track-view`;
      const payload = JSON.stringify({ isUnique });

      // Prefer beacon for reliability during route transitions/unloads.
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const queued = navigator.sendBeacon(
          endpoint,
          new Blob([payload], { type: "application/json" }),
        );
        if (queued) {
          return;
        }
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), TRACK_VIEW_TIMEOUT_MS);

      try {
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payload,
          keepalive: true,
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (error) {
        // Silently fail - view tracking is not critical
        if (process.env.NODE_ENV === "development") {
          console.debug("[ProductViewTracker] Track request skipped", error);
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    void trackView();
  }, [productId]);

  return null; // This component doesn't render anything
}
