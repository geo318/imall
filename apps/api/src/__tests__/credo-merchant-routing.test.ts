import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { env } from "../context";
import {
  createCredoInstallmentApplication,
  fetchCredoInstallmentStatus,
  validateOrderCodeForCart,
} from "../integrations/credo-installments";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
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
