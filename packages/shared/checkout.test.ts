import { expect, test } from "bun:test";
import { calculateCheckoutTotals } from "./src/checkout";

test("checkout totals include shipping and rounded commission for the bank charge", () => {
  expect(calculateCheckoutTotals([], "card").total).toBe(0);
  expect(calculateCheckoutTotals([{ price: "19.99", qty: 3 }], "installments")).toEqual({
    subtotal: 59.97,
    shipping: 9.99,
    installmentCommission: 7.2,
    total: 77.16,
  });
  expect(calculateCheckoutTotals([{ price: 100, qty: 1 }], "card").total).toBe(109.99);
  expect(calculateCheckoutTotals([{ price: 100.01, qty: 1 }], "card").total).toBe(100.01);
});
