import { auctions, bids, db, inventoryLedger, orderItems, orders, users } from "@repo/db";
import { and, eq, lte } from "drizzle-orm";
import { Elysia } from "elysia";
import {
  authPlugin,
  bidPayloadSchema,
  getAvailableStock,
  getTenantIdBySlug,
  INVENTORY_REASONS,
  listQuerySchema,
  type WsContext,
} from "../context";
import { logger } from "../utils/logger";
import { extractTokenFromHeader, verifyClerkToken } from "../utils/token";

type AuctionSocket = WsContext<{
  subscriptions?: Set<string>;
}>;
type AuctionSubscriptions = Record<string, Set<AuctionSocket>>;
const subscriptions: AuctionSubscriptions = {};

function broadcastBidEvent(auctionId: string, payload: unknown) {
  const sockets = subscriptions[auctionId];
  if (!sockets) return;
  const message = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }
}

async function closeExpiredAuctions() {
  const now = new Date();
  const expired = await db
    .select({
      id: auctions.id,
      tenantId: auctions.tenantId,
    })
    .from(auctions)
    .where(and(eq(auctions.status, "active"), lte(auctions.endsAt, now)))
    .limit(50);

  for (const auction of expired) {
    await db.update(auctions).set({ status: "finished" }).where(eq(auctions.id, auction.id));
    broadcastBidEvent(auction.id, {
      type: "auction.finished",
      auctionId: auction.id,
      reason: "time",
    });
  }
}

export const auctionsRoutes = new Elysia({
  prefix: "/shops/:shopSlug/auctions",
})
  .use(authPlugin)
  .get("/", async ({ params, query, set }) => {
    try {
      const { shopSlug } = params as { shopSlug: string };
      const tenantId = await getTenantIdBySlug(shopSlug);
      const { limit } = listQuerySchema.parse(query);
      const result = await db
        .select({
          id: auctions.id,
          status: auctions.status,
          currentPrice: auctions.currentPrice,
          highestBidId: auctions.highestBidId,
          startsAt: auctions.startsAt,
          endsAt: auctions.endsAt,
          buyNowPrice: auctions.buyNowPrice,
          variantId: auctions.variantId,
        })
        .from(auctions)
        .where(eq(auctions.tenantId, tenantId))
        .limit(limit);
      return result;
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to list auctions";
    }
  })
  .get("/:auctionId", async ({ params, set }) => {
    const { auctionId } = params as { shopSlug: string; auctionId: string };
    try {
      const result = await db
        .select({
          id: auctions.id,
          status: auctions.status,
          currentPrice: auctions.currentPrice,
          highestBidId: auctions.highestBidId,
          startsAt: auctions.startsAt,
          endsAt: auctions.endsAt,
          buyNowPrice: auctions.buyNowPrice,
          startingBid: auctions.startingBid,
        })
        .from(auctions)
        .where(eq(auctions.id, auctionId));
      if (result.length === 0) {
        set.status = 404;
        return "Auction not found";
      }
      return result[0];
    } catch (err) {
      if (err instanceof Response) return err;
      set.status = 500;
      return "Failed to load auction";
    }
  })
  .get("/:auctionId/bids", async ({ params }) => {
    const { auctionId } = params as { shopSlug: string; auctionId: string };
    const results = await db
      .select({
        id: bids.id,
        amount: bids.amount,
        createdAt: bids.createdAt,
        bidderId: bids.bidderId,
      })
      .from(bids)
      .where(eq(bids.auctionId, auctionId));
    return results;
  })
  .post("/:auctionId/bids", async ({ params, body, auth, request }) => {
    const { shopSlug, auctionId } = params as { shopSlug: string; auctionId: string };

    // Validate payload
    let payload: ReturnType<typeof bidPayloadSchema.parse>;
    try {
      payload = bidPayloadSchema.parse(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid bid payload";
      return new Response(message, { status: 400 });
    }

    // Get auth from plugin or manually verify if plugin didn't run
    let effectiveAuth = auth;
    if (!effectiveAuth?.userId) {
      // Fallback: manually verify token if authPlugin didn't populate auth
      const authHeader = request.headers.get("authorization");
      const token = extractTokenFromHeader(authHeader);

      if (token) {
        try {
          const verified = await verifyClerkToken(token);
          effectiveAuth = {
            userId: verified.userId,
            sessionId: verified.sessionId,
            orgId: verified.orgId,
            orgRole: verified.orgRole,
            orgSlug: verified.orgSlug,
            role: verified.role,
            claims: verified.claims,
          };
        } catch (error) {
          // Token verification failed
          logger.debug("[Auctions] Manual token verification failed:", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Require authentication
    if (!effectiveAuth?.userId) {
      return new Response("Authentication required", { status: 401 });
    }

    // Get or create user from Clerk userId (externalAuthId)
    const externalAuthId = effectiveAuth.userId;

    const tenantId = await getTenantIdBySlug(shopSlug);

    try {
      const {
        bidId,
        amount,
        endsAt: newEndsAt,
      } = await db.transaction(async (tx) => {
        // Get or create user
        let [existingUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.externalAuthId, externalAuthId))
          .limit(1);

        if (!existingUser) {
          // Create user if doesn't exist
          const [newUser] = await tx
            .insert(users)
            .values({
              id: crypto.randomUUID(),
              externalAuthId,
            })
            .returning({ id: users.id });
          existingUser = newUser;
        }

        if (!existingUser?.id) {
          logger.error("[Auctions] Failed to get or create user:", {
            externalAuthId,
          });
          throw new Response("Failed to get or create user", { status: 500 });
        }

        const [auction] = await tx
          .select({
            id: auctions.id,
            tenantId: auctions.tenantId,
            status: auctions.status,
            startsAt: auctions.startsAt,
            endsAt: auctions.endsAt,
            currentPrice: auctions.currentPrice,
            startingBid: auctions.startingBid,
            minIncrement: auctions.minIncrement,
            antiSnipeSeconds: auctions.antiSnipeSeconds,
          })
          .from(auctions)
          .where(and(eq(auctions.id, auctionId), eq(auctions.tenantId, tenantId)))
          .limit(1);

        if (!auction) {
          throw new Response("Auction not found", { status: 404 });
        }

        const now = new Date();
        const isActive = auction.status === "active";
        const hasStarted = auction.startsAt <= now;
        const hasNotEnded = auction.endsAt >= now;

        if (!isActive || !hasStarted || !hasNotEnded) {
          throw new Response("Auction is not active", { status: 409 });
        }

        const currentPrice = Number(auction.currentPrice ?? auction.startingBid ?? 0);
        const minIncrement = Math.max(0, Number(auction.minIncrement ?? 0));
        const minAllowed = auction.currentPrice
          ? currentPrice + minIncrement
          : Number(auction.startingBid ?? 0);

        if (Number(payload.amount) < Number(auction.startingBid ?? 0)) {
          throw new Response("Bid below starting bid", { status: 400 });
        }
        if (Number(payload.amount) < minAllowed) {
          throw new Response("Bid below minimum increment", { status: 400 });
        }

        const [inserted] = await tx
          .insert(bids)
          .values({
            id: crypto.randomUUID(),
            tenantId,
            auctionId,
            bidderId: existingUser.id, // Use the user's database ID, not Clerk ID
            amount: String(payload.amount),
          })
          .returning({ id: bids.id });

        let endsAt = auction.endsAt;
        if (auction.antiSnipeSeconds && auction.antiSnipeSeconds > 0) {
          const secondsLeft = (auction.endsAt.getTime() - now.getTime()) / 1000;
          if (secondsLeft <= auction.antiSnipeSeconds) {
            endsAt = new Date(auction.endsAt.getTime() + auction.antiSnipeSeconds * 1000);
          }
        }

        await tx
          .update(auctions)
          .set({
            currentPrice: String(payload.amount),
            highestBidId: inserted?.id,
            highestBidderId: externalAuthId, // Store Clerk user ID directly
            endsAt,
          })
          .where(eq(auctions.id, auctionId));

        return { bidId: inserted?.id, amount: payload.amount, endsAt };
      });

      // Get highest bidder's externalAuthId for WebSocket broadcast
      if (bidId) {
        const [highestBid] = await db
          .select({ bidderId: bids.bidderId })
          .from(bids)
          .where(eq(bids.id, bidId))
          .limit(1);

        if (highestBid?.bidderId) {
          const [bidderUser] = await db
            .select({ externalAuthId: users.externalAuthId })
            .from(users)
            .where(eq(users.id, highestBid.bidderId))
            .limit(1);

          broadcastBidEvent(auctionId, {
            type: "bid",
            auctionId,
            amount,
            bidderId: bidderUser?.externalAuthId ?? undefined,
            endsAt: newEndsAt,
          });
          return new Response(JSON.stringify({ id: bidId, amount, endsAt: newEndsAt }), {
            status: 201,
          });
        }
      }

      broadcastBidEvent(auctionId, {
        type: "bid",
        auctionId,
        amount,
        endsAt: newEndsAt,
      });

      return new Response(JSON.stringify({ id: bidId, amount, endsAt: newEndsAt }), {
        status: 201,
      });
    } catch (err) {
      if (err instanceof Response) {
        console.error("[Auctions] Bid placement failed with Response error:", {
          status: err.status,
          statusText: err.statusText,
          auctionId,
          shopSlug,
          payloadAmount: payload.amount,
        });
        return err;
      }

      const message = err instanceof Error ? err.message : "Failed to place bid";
      console.error("[Auctions] Bid placement failed with unexpected error:", {
        error: message,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        errorStack: err instanceof Error ? err.stack : undefined,
        auctionId,
        shopSlug,
        payloadAmount: payload.amount,
        externalAuthId,
      });
      return new Response(message, { status: 500 });
    }
  })
  .post("/:auctionId/buy-now", async ({ params }) => {
    const { shopSlug, auctionId } = params as { shopSlug: string; auctionId: string };
    const tenantId = await getTenantIdBySlug(shopSlug);
    try {
      const order = await db.transaction(async (tx) => {
        const [auction] = await tx
          .select({
            id: auctions.id,
            tenantId: auctions.tenantId,
            status: auctions.status,
            startsAt: auctions.startsAt,
            endsAt: auctions.endsAt,
            variantId: auctions.variantId,
            buyNowPrice: auctions.buyNowPrice,
          })
          .from(auctions)
          .where(and(eq(auctions.id, auctionId), eq(auctions.tenantId, tenantId)))
          .limit(1);

        if (!auction) {
          throw new Response("Auction not found", { status: 404 });
        }
        const now = new Date();
        if (auction.status !== "active" || auction.startsAt > now || auction.endsAt < now) {
          throw new Response("Auction is not active", { status: 409 });
        }
        if (!auction.buyNowPrice) {
          throw new Response("Buy-now not available", { status: 400 });
        }

        const available = await getAvailableStock(tenantId, auction.variantId);
        if (available < 1) {
          throw new Response("Insufficient stock", { status: 409 });
        }

        const [order] = await tx
          .insert(orders)
          .values({
            id: crypto.randomUUID(),
            tenantId,
            status: "pending",
            total: auction.buyNowPrice,
            currency: "USD",
          })
          .returning({
            id: orders.id,
            total: orders.total,
            currency: orders.currency,
          });
        if (!order) {
          throw new Response("Order creation failed", { status: 500 });
        }

        await tx.insert(orderItems).values({
          id: crypto.randomUUID(),
          tenantId,
          orderId: order.id,
          variantId: auction.variantId,
          qty: 1,
          unitPrice: auction.buyNowPrice,
        });

        await tx.insert(inventoryLedger).values({
          id: crypto.randomUUID(),
          tenantId,
          variantId: auction.variantId,
          delta: -1,
          reason: INVENTORY_REASONS.SALE,
          refType: "order",
          refId: order.id,
        });

        await tx
          .update(auctions)
          .set({ status: "finished", endsAt: new Date() })
          .where(eq(auctions.id, auctionId));

        return order;
      });

      if (!order) {
        throw new Response("Failed to create order", { status: 500 });
      }

      broadcastBidEvent(auctionId, {
        type: "auction.finished",
        auctionId,
        reason: "buy-now",
      });
      return new Response(
        JSON.stringify({
          orderId: order.id,
          total: order.total,
          currency: order.currency,
        }),
        {
          status: 201,
        },
      );
    } catch (err) {
      if (err instanceof Response) return err;
      const message = err instanceof Error ? err.message : "Buy-now failed";
      return new Response(message, { status: 500 });
    }
  })
  .ws("/ws/auctions/:auctionId", {
    open(ws) {
      // Extract auctionId from the WebSocket route params
      // In Elysia, WebSocket params are available via the route pattern
      const auctionId = (ws as unknown as { params: { auctionId: string } }).params?.auctionId;
      if (!auctionId) {
        ws.close();
        return;
      }
      const subs = new Set<string>([auctionId]);
      (ws.data as { subscriptions?: Set<string> }).subscriptions = subs;
      subscriptions[auctionId] ??= new Set();
      subscriptions[auctionId].add(ws as AuctionSocket);
      ws.send(JSON.stringify({ type: "subscribed", auctionId }));
    },
    message(ws, message) {
      try {
        const data = JSON.parse(message as string);
        if (data.action === "subscribe" && typeof data.auctionId === "string") {
          const auctionId = data.auctionId;
          const wsData = ws.data as { subscriptions?: Set<string> };
          const subs = wsData.subscriptions ?? new Set<string>();
          subs.add(auctionId);
          wsData.subscriptions = subs;
          subscriptions[auctionId] ??= new Set();
          subscriptions[auctionId].add(ws as AuctionSocket);
          ws.send(JSON.stringify({ type: "subscribed", auctionId }));
        }
      } catch {
        ws.send(JSON.stringify({ error: "Invalid message" }));
      }
    },
    close(ws) {
      const wsData = ws.data as { subscriptions?: Set<string> };
      const subs = wsData.subscriptions;
      if (subs) {
        for (const auctionId of subs) {
          subscriptions[auctionId]?.delete(ws as AuctionSocket);
        }
      }
    },
  });

export function startAuctionCloser() {
  setInterval(() => {
    closeExpiredAuctions().catch((err) => console.error("close auctions failed", err));
  }, 30_000);
}
