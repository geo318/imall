import { carts, db, orders } from "@repo/db";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { z } from "zod";
import { completeCartCheckout } from "./carts";
import { decryptKeepzEnvelope } from "../integrations/keepz-ecommerce";
import { logger } from "../utils/logger";

const KEEPZ_SUCCESS_STATUSES = new Set(["SUCCESS"]);
const KEEPZ_CANCELLED_STATUSES = new Set(["FAILED", "CANCELED", "EXPIRED"]);

const callbackBodySchema = z
  .object({
    integratorOrderId: z.string().trim().optional(),
    status: z.string().trim().optional(),
    encryptedData: z.string().trim().optional(),
    encryptedKeys: z.string().trim().optional(),
  })
  .passthrough();

function toKeepzFlowStage(status: string, fallback: string | null): string | null {
  if (status === "SUCCESS") return "completed";
  if (status === "PROCESSING") return "pending";
  if (status === "INITIAL") return "approved";
  if (status === "CANCELED") return "cancelled";
  if (status === "EXPIRED") return "expired";
  if (status === "FAILED") return "failed";
  return fallback;
}

function parseCallbackBody(body: unknown): {
  orderCode: string;
  status: string;
  raw: unknown;
} | null {
  const parsed = callbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }

  const payload = parsed.data;
  const encryptedData = payload.encryptedData;
  const encryptedKeys = payload.encryptedKeys;

  if (encryptedData && encryptedKeys) {
    const decrypted = decryptKeepzEnvelope({ encryptedData, encryptedKeys });
    if (!decrypted || typeof decrypted !== "object") {
      return null;
    }
    const decryptedPayload = decrypted as Record<string, unknown>;
    const orderCode =
      typeof decryptedPayload.integratorOrderId === "string"
        ? decryptedPayload.integratorOrderId.trim()
        : "";
    const status =
      typeof decryptedPayload.status === "string" ? decryptedPayload.status.trim().toUpperCase() : "";
    if (!orderCode || !status) {
      return null;
    }
    return { orderCode, status, raw: decrypted };
  }

  const orderCode = payload.integratorOrderId?.trim() || "";
  const status = payload.status?.trim().toUpperCase() || "";
  if (!orderCode || !status) {
    return null;
  }

  return { orderCode, status, raw: payload };
}

export const keepzCallbackRoutes = new Elysia({
  prefix: "/payments/keepz",
}).post("/callback", async ({ body, query, set }) => {
  const queryRecord =
    query && typeof query === "object" ? (query as Record<string, unknown>) : null;
  const cartId =
    queryRecord && typeof queryRecord.cartId === "string"
      ? queryRecord.cartId.trim()
      : "";
  const paymentType =
    queryRecord &&
    typeof queryRecord.paymentType === "string" &&
    queryRecord.paymentType.trim() === "card"
      ? "card"
      : "installments";

  try {
    const event = parseCallbackBody(body);
    if (!event) {
      logger.warn("[Keepz Callback] Ignoring malformed callback payload");
      set.status = 200;
      return { received: true };
    }

    logger.info("[Keepz Callback] Received callback", {
      orderCode: event.orderCode,
      status: event.status,
      hasCartId: Boolean(cartId),
      paymentType,
    });

    const [existingOrder] = await db
      .select({
        id: orders.id,
        status: orders.status,
        installmentFlowStage: orders.installmentFlowStage,
      })
      .from(orders)
      .where(eq(orders.installmentOrderCode, event.orderCode))
      .limit(1);

    if (existingOrder) {
      const orderPatch: Partial<typeof orders.$inferInsert> = {
        installmentStatusId: null,
        installmentStatusName: event.status,
        installmentFlowStage: toKeepzFlowStage(event.status, existingOrder.installmentFlowStage),
      };

      if (KEEPZ_SUCCESS_STATUSES.has(event.status) && existingOrder.status !== "completed") {
        orderPatch.status = "completed";
        orderPatch.installmentDeliveredAt = new Date();
        orderPatch.installmentVerificationCode = null;
      } else if (
        KEEPZ_CANCELLED_STATUSES.has(event.status) &&
        existingOrder.status !== "completed"
      ) {
        orderPatch.status = "cancelled";
      }

      await db.update(orders).set(orderPatch).where(eq(orders.id, existingOrder.id));
      set.status = 200;
      return { received: true };
    }

    if (cartId && KEEPZ_SUCCESS_STATUSES.has(event.status)) {
      const [cart] = await db
        .select({ id: carts.id, status: carts.status, userId: carts.userId })
        .from(carts)
        .where(eq(carts.id, cartId))
        .limit(1);

      if (cart?.status === "open") {
        await completeCartCheckout(cartId, cart.userId ?? null, {
          paymentMethod: paymentType === "card" ? "card_keepz" : "installments_keepz",
          orderStatus: "completed",
          installmentOrderCode: event.orderCode,
          installmentStatusId: null,
          installmentStatusName: event.status,
          installmentFlowStage: "completed",
        });
      }
    }
  } catch (error) {
    logger.error("[Keepz Callback] Failed to process callback", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  set.status = 200;
  return { received: true };
});
