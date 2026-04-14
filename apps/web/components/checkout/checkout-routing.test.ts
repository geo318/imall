import { describe, expect, test } from "bun:test";
import {
  buildCheckoutSignInRedirectPath,
  sanitizeCheckoutCartKey,
  stringifyCheckoutSearchParams,
} from "./checkout-routing";

describe("checkout routing helpers", () => {
  test("keeps valid cartKey query value", () => {
    expect(sanitizeCheckoutCartKey("cart:buy-now", "cart")).toBe("cart:buy-now");
    expect(sanitizeCheckoutCartKey("cart_shop-1", "cart")).toBe("cart_shop-1");
  });

  test("falls back to default cartKey when query value is invalid", () => {
    expect(sanitizeCheckoutCartKey("bad key with spaces", "cart")).toBe("cart");
    expect(sanitizeCheckoutCartKey("../../etc/passwd", "cart")).toBe("cart");
    expect(sanitizeCheckoutCartKey("", "cart")).toBe("cart");
    expect(sanitizeCheckoutCartKey(undefined, "cart")).toBe("cart");
  });

  test("serializes mixed search params with arrays", () => {
    const query = stringifyCheckoutSearchParams({
      payment: "installments",
      provider: "keepz",
      cartKey: "cart:buy-now",
      tag: ["one", "two"],
      ignored: undefined,
    });

    expect(query).toBe(
      "?payment=installments&provider=keepz&cartKey=cart%3Abuy-now&tag=one&tag=two",
    );
  });

  test("builds sign-in redirect with encoded checkout path and query", () => {
    const redirectPath = buildCheckoutSignInRedirectPath("/ka/checkout", {
      payment: "installments",
      provider: "keepz",
      cartKey: "cart:buy-now",
    });

    expect(redirectPath).toBe(
      "/sign-in?redirect_url=%2Fka%2Fcheckout%3Fpayment%3Dinstallments%26provider%3Dkeepz%26cartKey%3Dcart%253Abuy-now",
    );
  });
});
