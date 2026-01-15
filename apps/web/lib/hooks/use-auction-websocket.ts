"use client";

import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

type AuctionWebSocketMessage =
  | { type: "subscribed"; auctionId: string }
  | { type: "bid"; auctionId: string; amount: string; bidderId?: string; endsAt: string }
  | { type: "auction.finished"; auctionId: string; reason: string }
  | { type: "error"; error: string };

type UseAuctionWebSocketOptions = {
  shopSlug: string;
  auctionId: string;
  enabled?: boolean;
  onMessage?: (message: AuctionWebSocketMessage) => void;
};

/**
 * WebSocket hook for real-time auction updates
 * Replaces polling with efficient WebSocket connections
 */
export function useAuctionWebSocket({
  shopSlug,
  auctionId,
  enabled = true,
  onMessage,
}: UseAuctionWebSocketOptions) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onMessageRef = useRef(onMessage);
  const getTokenRef = useRef(getToken);
  const queryClientRef = useRef(queryClient);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // Start with 1 second

  // Update refs when values change (but don't trigger reconnection)
  useEffect(() => {
    onMessageRef.current = onMessage;
    getTokenRef.current = getToken;
    queryClientRef.current = queryClient;
  }, [onMessage, getToken, queryClient]);

  useEffect(() => {
    if (!enabled || !auctionId || !shopSlug) {
      return;
    }

    let mounted = true;
    let ws: WebSocket | null = null;

    const connect = async () => {
      try {
        // Get Clerk token for authentication (use ref to avoid dependency issues)
        const token = await getTokenRef.current();

        // Build WebSocket URL
        // In Next.js, NEXT_PUBLIC_* vars are inlined at build time and available via process.env
        // For development, backend is on port 3001; in production, use NEXT_PUBLIC_BACKEND_URL or same domain
        let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

        if (!backendUrl && globalThis.window !== undefined) {
          // Fallback: infer from current location
          const isLocalhost = globalThis.window.location.hostname === "localhost";
          backendUrl = isLocalhost
            ? "http://localhost:3001"
            : `${globalThis.window.location.protocol}//${globalThis.window.location.host}`;
        }

        if (!backendUrl) {
          backendUrl = "http://localhost:3001"; // Final fallback
        }
        // Convert http:// to ws:// or https:// to wss://
        const wsProtocol = backendUrl.startsWith("https") ? "wss" : "ws";
        const wsBaseUrl = backendUrl.replace(/^https?:\/\//, `${wsProtocol}://`);
        const wsUrl = `${wsBaseUrl}/api/shops/${shopSlug}/auctions/ws/auctions/${auctionId}`;

        // Add token as query parameter if available (Elysia WebSocket may not support headers)
        const urlWithAuth = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;

        ws = new WebSocket(urlWithAuth);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted) return;
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
          console.log(`[WebSocket] Connected to auction ${auctionId}`);
        };

        ws.onmessage = (event) => {
          if (!mounted) return;
          try {
            const message: AuctionWebSocketMessage = JSON.parse(event.data);

            // Handle different message types
            switch (message.type) {
              case "subscribed":
                console.log(`[WebSocket] Subscribed to auction ${message.auctionId}`);
                break;

              case "bid":
                // Invalidate React Query cache to trigger refetch (use ref to avoid dependency issues)
                queryClientRef.current.invalidateQueries({
                  queryKey: ["product"],
                });
                console.log(
                  `[WebSocket] New bid: $${message.amount} on auction ${message.auctionId}`,
                );
                break;

              case "auction.finished":
                // Invalidate cache and stop reconnecting (use ref to avoid dependency issues)
                queryClientRef.current.invalidateQueries({
                  queryKey: ["product"],
                });
                console.log(`[WebSocket] Auction ${message.auctionId} finished: ${message.reason}`);
                break;

              case "error":
                console.error(`[WebSocket] Error: ${message.error}`);
                setConnectionError(message.error);
                break;
            }

            // Call custom message handler if provided (use ref to avoid dependency issues)
            onMessageRef.current?.(message);
          } catch (error) {
            console.error("[WebSocket] Failed to parse message:", error);
          }
        };

        ws.onerror = (error) => {
          if (!mounted) return;
          console.error("[WebSocket] Connection error:", error);
          setConnectionError("WebSocket connection error");
        };

        ws.onclose = (event) => {
          if (!mounted) return;
          setIsConnected(false);
          wsRef.current = null;

          // Only attempt reconnect if not a normal closure and we haven't exceeded max attempts
          if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = baseReconnectDelay * 2 ** reconnectAttemptsRef.current;
            reconnectAttemptsRef.current++;
            console.log(
              `[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mounted) {
                connect();
              }
            }, delay);
          } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
            setConnectionError("Failed to connect after multiple attempts");
            console.error("[WebSocket] Max reconnection attempts reached");
          }
        };
      } catch (error) {
        if (!mounted) return;
        console.error("[WebSocket] Failed to create connection:", error);
        setConnectionError(error instanceof Error ? error.message : "Failed to connect");
      }
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
    // Only depend on stable values - onMessage is handled via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, shopSlug, auctionId]);

  return {
    isConnected,
    connectionError,
  };
}
