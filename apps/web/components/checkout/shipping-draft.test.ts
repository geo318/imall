import { expect, test } from "bun:test";
import {
  EMPTY_SHIPPING_FORM,
  mapShippingFormToAddressInput,
  parseCheckoutShippingDraft,
} from "./types";

test("empty optional address fields are sent explicitly so saved values can be cleared", () => {
  const payload = mapShippingFormToAddressInput({ ...EMPTY_SHIPPING_FORM, firstName: " Test " });
  expect(payload.firstName).toBe("Test");
  expect(JSON.parse(JSON.stringify(payload))).toMatchObject({
    email: null,
    phone: null,
    region: null,
    postalCode: null,
  });
});

test("shipping drafts restore the entered address without trusting malformed storage", () => {
  const shipping = { ...EMPTY_SHIPPING_FORM, firstName: "Test", city: "Tbilisi" };
  expect(parseCheckoutShippingDraft(JSON.stringify(shipping))).toEqual(shipping);
  for (const invalid of [
    null,
    "invalid",
    "[]",
    "{}",
    JSON.stringify({ ...shipping, phone: 599 }),
    JSON.stringify({ ...shipping, address: "x".repeat(257) }),
  ]) {
    expect(parseCheckoutShippingDraft(invalid)).toBeNull();
  }
});
