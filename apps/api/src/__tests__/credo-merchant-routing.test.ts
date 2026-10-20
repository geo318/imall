import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { env } from "../context";
import { markCredoInstallmentAsDelivered } from "../integrations/credo-additional-services";
import {
  createCredoInstallmentApplication,
  fetchCredoInstallmentStatus,
  validateOrderCodeForCart,
} from "../integrations/credo-installments";

const originalFetch = globalThis.fetch;
const originalCredentials = {
  CREDO_MERCHANT_ID: env.CREDO_MERCHANT_ID,
  CREDO_ADDITIONAL_USERNAME: env.CREDO_ADDITIONAL_USERNAME,
  CREDO_ADDITIONAL_PASSWORD: env.CREDO_ADDITIONAL_PASSWORD,
};
afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.assign(env, originalCredentials);
});

test("each Credo product keeps its shop ID through creation and status lookup", async () => {
  const cartId = "12345678-1234-4234-8234-123456789abc";
  for (const merchantId of ["133469", "134582"]) {
    let createdOrderCode = "";
    globalThis.fetch = (async (input, init) => {
      if (init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        expect(payload.merchantId).toBe(merchantId);
        createdOrderCode = payload.orderCode;
        return Response.json({ url: "https://ganvadeba.credo.ge/application" });
      }
      const url = new URL(String(input));
      expect(url.searchParams.get("merchantId")).toBe(merchantId);
      expect(url.searchParams.get("orderCode")).toBe(createdOrderCode);
      return Response.json({ data: 3 });
    }) as typeof fetch;

    const session = await createCredoInstallmentApplication({
      cartId,
      merchantId,
      products: [{ id: "item", title: "Product", amount: 1, price: 10000, type: 0 }],
    });
    expect(session.orderCode.length).toBeLessThanOrEqual(50);
    expect(validateOrderCodeForCart(session.orderCode, cartId)).toBe(true);
    expect(validateOrderCodeForCart(session.orderCode, crypto.randomUUID())).toBe(false);
    const tampered = session.orderCode.replace(
      /\d+$/,
      merchantId === "133469" ? "134582" : "133469",
    );
    expect(validateOrderCodeForCart(tampered, cartId)).toBe(false);
    expect((await fetchCredoInstallmentStatus(session.orderCode)).statusId).toBe(3);
  }
});

test("existing signed order codes remain valid", () => {
  const cartId = "12345678-1234-4234-8234-123456789abc";
  const signature = createHash("md5")
    .update(`${cartId}:timestamp:abcdef:${env.CREDO_SHARED_SECRET?.trim() ?? ""}`)
    .digest("hex")
    .slice(0, 10);
  expect(validateOrderCodeForCart(`IML-12345678-timestamp-abcdef-${signature}`, cartId)).toBe(true);
});

test("delivery uses the originating shop with cached authentication and token refresh", async () => {
  Object.assign(env, {
    CREDO_MERCHANT_ID: "134582",
    CREDO_ADDITIONAL_USERNAME: "test-user",
    CREDO_ADDITIONAL_PASSWORD: "test-password",
  });
  let authCalls = 0;
  const deliveries: number[] = [];
  globalThis.fetch = (async (input, init) => {
    if (String(input).endsWith("/User/Authenticate")) {
      authCalls++;
      return Response.json({ data: { token: `token-${authCalls}`, merchantId: 134582 } });
    }
    expect(String(input)).toEndWith("/Shop/MarkAsDelivered");
    const body = JSON.parse(String(init?.body));
    deliveries.push(body.MerchantId);
    if (deliveries.length === 1) return Response.json({ state: 1 });
    return Response.json({ data: { success: true } });
  }) as typeof fetch;

  // These are persisted order codes; cart ownership/signatures are checked at creation/sync.
  for (const suffix of ["-133469", "-134582", ""]) {
    const result = await markCredoInstallmentAsDelivered(
      `IML-12345678-timestamp-abcdef-signature${suffix}`,
    );
    expect(result.success).toBe(true);
  }
  expect(deliveries).toEqual([133469, 133469, 134582, 134582]);
  expect(authCalls).toBe(2);
});
