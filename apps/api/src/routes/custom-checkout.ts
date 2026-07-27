import { timingSafeEqual } from "node:crypto";
import { Elysia } from "elysia";
import { z } from "zod";
import { env } from "../context";
import {
  type CredoInstallmentProduct,
  createCredoInstallmentApplication,
} from "../integrations/credo-installments";
import { logger } from "../utils/logger";

// Manual/ad-hoc Credo installment checkout. Unlike the cart-based flow this
// accepts free-form products (title + price) that don't exist in the catalog,
// so an operator can send an arbitrary basket to Credo. Gated by a shared
// password (CUSTOM_CHECKOUT_PASS) instead of the normal auth/cart ownership.
const CREDO_COMMISSION_RATE = 0.12;

// iMall fallbacks mirror the cart route; Credo requires customer contact fields.
const FALLBACK_CLIENT_NAME = "iMall Support";
const FALLBACK_EMAIL = "contact@imall.ge";
const FALLBACK_ADDRESS = "Kostava Ave. 4, Tbilisi, Georgia 0105";
const FALLBACK_MOBILE = "595000000";

const customProductSchema = z.object({
  title: z.string().trim().min(1).max(90),
  price: z.coerce.number().positive().max(1_000_000),
  qty: z.coerce.number().int().positive().max(999).default(1),
});

const customCheckoutSchema = z.object({
  pass: z.string().min(1),
  products: z.array(customProductSchema).min(1).max(50),
  clientFullName: z.string().trim().max(128).optional(),
  mobile: z.string().trim().max(32).optional(),
  email: z.string().email().max(256).optional(),
  factAddress: z.string().trim().max(256).optional(),
  installmentLength: z.coerce.number().int().positive().max(60).optional(),
  credoVariant: z.enum(["zero", "standard"]).default("zero"),
});

function passwordMatches(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // Length check first; timingSafeEqual throws on mismatched lengths.
  return a.length === b.length && timingSafeEqual(a, b);
}

export const customCheckoutRoutes = new Elysia({ prefix: "/custom-checkout" }).post(
  "/credo",
  async ({ body, set }) => {
    let payload: z.infer<typeof customCheckoutSchema>;
    try {
      payload = customCheckoutSchema.parse(body);
    } catch (error) {
      set.status = 400;
      return {
        error: "Invalid custom checkout payload",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    const expectedPass = env.CUSTOM_CHECKOUT_PASS?.trim();
    if (!expectedPass) {
      set.status = 503;
      return { error: "Custom checkout is not configured", code: "CUSTOM_CHECKOUT_NOT_CONFIGURED" };
    }
    if (!passwordMatches(payload.pass, expectedPass)) {
      set.status = 401;
      return { error: "Invalid password" };
    }

    const isZero = payload.credoVariant === "zero";
    const merchantId = isZero
      ? env.CREDO_ZERO_MERCHANT_ID?.trim() || env.CREDO_MERCHANT_ID?.trim()
      : env.CREDO_MERCHANT_ID?.trim();
    if (!merchantId) {
      set.status = 503;
      return { error: "Credo installments are not configured", code: "CREDO_NOT_CONFIGURED" };
    }

    // Synthetic cart id: only used to derive the Credo order code signature.
    const cartId = crypto.randomUUID();

    const credoProducts: CredoInstallmentProduct[] = payload.products.map((product, index) => ({
      id: `item-${index + 1}`,
      title: product.title,
      amount: product.qty,
      // Credo prices are in tetri (integer minor units).
      price: Math.max(1, Math.round(product.price * 100)),
      type: 0,
    }));

    const subtotal = payload.products.reduce(
      (sum, product) => sum + product.price * product.qty,
      0,
    );
    const commissionTetri = Math.round(subtotal * CREDO_COMMISSION_RATE * 100);
    if (commissionTetri > 0) {
      credoProducts.push({
        id: `fee-${cartId.slice(0, 8)}`,
        title: "Installment commission",
        amount: 1,
        price: commissionTetri,
        type: 0,
      });
    }

    try {
      const session = await createCredoInstallmentApplication({
        cartId,
        merchantId,
        products: credoProducts,
        installmentLength: payload.installmentLength,
        clientFullName: payload.clientFullName?.trim() || FALLBACK_CLIENT_NAME,
        mobile: payload.mobile?.trim() || FALLBACK_MOBILE,
        email: payload.email?.trim() || FALLBACK_EMAIL,
        factAddress: payload.factAddress?.trim() || FALLBACK_ADDRESS,
        meta: { mediatorShopName: "iMall" },
      });

      logger.info("[Custom Checkout] Created Credo installment session", {
        cartId,
        productsCount: credoProducts.length,
        subtotal: Number(subtotal.toFixed(2)),
        credoVariant: payload.credoVariant,
        orderCode: session.orderCode,
      });

      return {
        orderCode: session.orderCode,
        redirectUrl: session.redirectUrl,
        provider: "credo",
        paymentType: "installments",
      };
    } catch (error) {
      logger.error("[Custom Checkout] Failed to start Credo installments", {
        cartId,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 502;
      return {
        error: "Failed to start Credo installments",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },
);
