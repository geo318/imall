import { describe, expect, test } from "bun:test";
import { resolveCheckoutErrorMessage, shouldShowCheckoutErrorToast } from "./checkout-errors";

describe("checkout error helpers", () => {
  test("prefers controller error over launch query error", () => {
    expect(resolveCheckoutErrorMessage("Controller error", "Launch error")).toBe("Controller error");
  });

  test("falls back to launch query error when controller error is empty", () => {
    expect(resolveCheckoutErrorMessage(null, "Launch error")).toBe("Launch error");
  });

  test("returns null when no error is present", () => {
    expect(resolveCheckoutErrorMessage(null, null)).toBeNull();
  });

  test("shows toast only for new non-empty errors", () => {
    expect(shouldShowCheckoutErrorToast("Error 1", null)).toBe(true);
    expect(shouldShowCheckoutErrorToast("Error 1", "Error 1")).toBe(false);
    expect(shouldShowCheckoutErrorToast(null, "Error 1")).toBe(false);
  });
});
