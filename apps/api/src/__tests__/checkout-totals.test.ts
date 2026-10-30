import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { db } from "@repo/db";
import { env } from "../context";
import { cartRoutes } from "../routes/carts";

const originalSelect = db.select;
const originalUpdate = db.update;
const originalTransaction = db.transaction;
const originalFetch = globalThis.fetch;
const originalMerchant = env.CREDO_ZERO_MERCHANT_ID;
afterEach(() => {
  db.select = originalSelect;
  db.update = originalUpdate;
  db.transaction = originalTransaction;
  globalThis.fetch = originalFetch;
  Object.assign(env, { CREDO_ZERO_MERCHANT_ID: originalMerchant });
});

test("an unpaid direct checkout cannot create an order", async () => {
  let transactions = 0;
  db.transaction = (async () => {
    transactions += 1;
    throw new Error("Unexpected database write");
  }) as typeof db.transaction;
  const response = await cartRoutes.handle(
    new Request("http://localhost/carts/cart/checkout", { method: "POST" }),
  );
  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("ONLINE_PAYMENT_REQUIRED");
  expect(transactions).toBe(0);
});

// Script all reads so these route regressions never access a real database.
function mockReads(rows: unknown[][]) {
  db.select = (() => {
    const next = rows.shift();
    if (!next) throw new Error("Unexpected database read");
    const query = Object.assign(Promise.resolve(next), {} as Record<string, unknown>);
    for (const method of ["from", "where", "leftJoin", "limit", "groupBy"]) {
      query[method] = () => query;
    }
    return query;
  }) as unknown as typeof db.select;
}

test("Credo receives exactly the displayed total including delivery and commission", async () => {
  Object.assign(env, { CREDO_ZERO_MERCHANT_ID: "133469" });
  const cartId = "12345678-1234-4234-8234-123456789abc";
  mockReads([
    [
      {
        cartId,
        status: "open",
        userId: null,
        variantId: "variant",
        tenantId: "shop",
        qty: 3,
        price: "19.99",
        productId: "product",
        productTitle: "Product",
      },
    ],
    [{ id: "variant", trackInventory: false }],
    [],
    [{ shopId: "shop", shopSlug: "shop-1", shopName: "Shop" }],
  ]);
  let chargedTetri = 0;
  globalThis.fetch = (async (_url, init) => {
    const payload = JSON.parse(String(init?.body));
    chargedTetri = payload.products.reduce(
      (sum: number, product: { price: number; amount: number }) =>
        sum + product.price * product.amount,
      0,
    );
    return Response.json({ url: "https://ganvadeba.credo.ge/application" });
  }) as typeof fetch;
  const response = await cartRoutes.handle(
    new Request(`http://localhost/carts/${cartId}/checkout/installments/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "credo",
        credoVariant: "zero",
        paymentType: "installments",
        email: "",
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(chargedTetri).toBe(7716);
});

test("a completed cart returns its consumed status and no purchasable items", async () => {
  mockReads([[{ id: "cart", status: "completed", userId: null }]]);
  const response = await cartRoutes.handle(new Request("http://localhost/carts/cart"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: "cart", status: "completed", items: [] });
});

test("completed cart status still requires the cart owner's authentication", async () => {
  mockReads([[{ id: "cart", status: "completed", userId: "another-user" }]]);
  const response = await cartRoutes.handle(new Request("http://localhost/carts/cart"));
  expect(response.status).toBe(403);
});

test("an already-created approved Credo order still counts as checked out", async () => {
  const cartId = "12345678-1234-4234-8234-123456789abc";
  const signature = createHash("md5")
    .update(`${cartId}:timestamp:abcdef:${env.CREDO_SHARED_SECRET?.trim() ?? ""}`)
    .digest("hex")
    .slice(0, 10);
  const orderCode = `IML-12345678-timestamp-abcdef-${signature}`;
  mockReads([
    [{ id: cartId, status: "completed", userId: null }],
    [{ id: "order", status: "approved", installmentFlowStage: "approved" }],
  ]);
  db.update = (() => ({
    set: () => ({ where: () => Promise.resolve([]) }),
  })) as unknown as typeof db.update;
  globalThis.fetch = (async (_url, _init) => Response.json({ data: 3 })) as typeof fetch;
  const response = await cartRoutes.handle(
    new Request(`http://localhost/carts/${cartId}/checkout/installments/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "credo", orderCode }),
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).checkoutCompleted).toBe(true);
});
