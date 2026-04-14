import { describe, expect, test } from "bun:test";
import {
  buildBuyNowCheckoutHref,
  BUY_NOW_CART_KEY,
  BUY_NOW_ITEM_QUANTITY,
  createIsolatedBuyNowCart,
} from "./product-buttons.logic";

describe("product buy-now flow", () => {
  test("creates isolated cart and adds exactly one item", async () => {
    const calls = {
      createCart: 0,
      addToCart: [] as Array<{ cartId: string; variantId: string; quantity: number }>,
      writeCartId: [] as Array<{ cartId: string; key: string }>,
    };

    const cartId = await createIsolatedBuyNowCart("variant-1", {
      createCart: async () => {
        calls.createCart += 1;
        return { ok: true, data: { id: "cart-buy-now-1" } };
      },
      addToCart: async (targetCartId, variantId, quantity) => {
        calls.addToCart.push({ cartId: targetCartId, variantId, quantity });
        return { ok: true };
      },
      writeCartId: (targetCartId, key) => {
        calls.writeCartId.push({ cartId: targetCartId, key });
      },
    });

    expect(cartId).toBe("cart-buy-now-1");
    expect(calls.createCart).toBe(1);
    expect(calls.addToCart).toEqual([
      { cartId: "cart-buy-now-1", variantId: "variant-1", quantity: BUY_NOW_ITEM_QUANTITY },
    ]);
    expect(calls.writeCartId).toEqual([{ cartId: "cart-buy-now-1", key: BUY_NOW_CART_KEY }]);
  });

  test("throws when cart creation fails", async () => {
    const run = createIsolatedBuyNowCart("variant-1", {
      createCart: async () => ({ ok: false, error: "Create failed" }),
      addToCart: async () => ({ ok: true }),
      writeCartId: () => {},
    });

    expect(run).rejects.toThrow("Create failed");
  });

  test("throws when item add fails", async () => {
    const run = createIsolatedBuyNowCart("variant-1", {
      createCart: async () => ({ ok: true, data: { id: "cart-buy-now-1" } }),
      addToCart: async () => ({ ok: false, error: "Add failed" }),
      writeCartId: () => {},
    });

    expect(run).rejects.toThrow("Add failed");
  });

  test("builds checkout href with encoded cart key", () => {
    expect(buildBuyNowCheckoutHref()).toBe("/checkout?cartKey=cart%3Abuy-now");
  });
});
