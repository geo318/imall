import { expect, test } from "bun:test";
import {
  normalizeCheckoutReturnPath,
  normalizeCredoRedirectUrl,
  normalizeKeepzRedirectUrl,
  readPersistedInstallmentState,
} from "./credo-launch";

test("bank redirects require HTTPS and an exact bank domain or subdomain", () => {
  for (const [normalize, domain] of [
    [normalizeCredoRedirectUrl, "credo.ge"],
    [normalizeKeepzRedirectUrl, "keepz.me"],
  ] as const) {
    expect(normalize(`http://pay.${domain}/checkout`)).toBe(`https://pay.${domain}/checkout`);
    for (const invalid of [
      `https://evil${domain}/`,
      `https://${domain}.evil.com/`,
      `https://user:pass@${domain}/`,
      `ftp://${domain}/`,
      "javascript:alert(1)",
      "invalid",
    ]) {
      expect(normalize(invalid)).toBe("");
    }
  }
});

test("checkout return paths cannot navigate to another origin", () => {
  expect(normalizeCheckoutReturnPath("/ka/checkout?provider=credo")).toBe(
    "/ka/checkout?provider=credo",
  );
  for (const invalid of ["//evil.com", "/\\evil.com", "https://evil.com", "/\n/evil.com"]) {
    expect(normalizeCheckoutReturnPath(invalid)).toBe("/");
  }
});

test("tampered pending cookies never restore an unsafe bank link", () => {
  const state = readPersistedInstallmentState(
    "cart",
    "checkout_installment_cart_key=cart; checkout_installment_order_code=order; checkout_installment_redirect_url=javascript%3Aalert(1)",
  );
  expect(state?.redirectUrl).toBe("");
});

test("a pending bank session is restored only for its original cart", () => {
  const cookies =
    "checkout_installment_cart_key=cart%3Abuy-now; checkout_installment_cart_id=first-cart; checkout_installment_order_code=order";
  expect(readPersistedInstallmentState("cart:buy-now", cookies, "first-cart")?.orderCode).toBe(
    "order",
  );
  expect(readPersistedInstallmentState("cart:buy-now", cookies, "second-cart")).toBeNull();
  expect(readPersistedInstallmentState("cart", cookies, "first-cart")).toBeNull();
});
