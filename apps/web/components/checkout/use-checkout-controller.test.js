import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EMPTY_SHIPPING_FORM } from "./types";
import {
  clearCheckoutCartKeys,
  getCredoLaunchBlockReason,
  isCredoLaunchReady,
  isOnlineInstallmentCartEligible,
  matchingAddressNeedsRefresh,
  resolveStoredCartId,
} from "./use-checkout-controller";

function createStorage(initialEntries = {}) {
  const storage = new Map(Object.entries(initialEntries));

  return {
    get length() {
      return storage.size;
    },
    key(index) {
      return [...storage.keys()][index] ?? null;
    },
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
    clear() {
      storage.clear();
    },
  };
}

function createShippingForm(overrides = {}) {
  return {
    ...EMPTY_SHIPPING_FORM,
    firstName: "Giorgi",
    lastName: "Lomidze",
    email: "geo@example.com",
    address: "Tbilisi",
    city: "Tbilisi",
    phone: "+995 599 123 456",
    ...overrides,
  };
}

const originalWindow = globalThis.window;

describe("use-checkout-controller credo readiness", () => {
  beforeEach(() => {
    const localStorage = createStorage();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage,
        dispatchEvent() {},
      },
    });
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.window;
      return;
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("shop checkout stays clickable when cart only exists under global cart key", () => {
    globalThis.window.localStorage.setItem("cart", "cart-global-1");

    const shippingForm = createShippingForm();

    expect(resolveStoredCartId("cart:imall-162295")).toBe("cart-global-1");
    expect(globalThis.window.localStorage.getItem("cart:imall-162295")).toBe("cart-global-1");
    expect(isCredoLaunchReady("cart:imall-162295", shippingForm)).toBe(true);
  });

  test("generic checkout stays clickable when cart only exists under slug-scoped cart key", () => {
    globalThis.window.localStorage.setItem("cart:imall-162295", "cart-shop-1");

    const shippingForm = createShippingForm();

    expect(resolveStoredCartId("cart")).toBe("cart-shop-1");
    expect(globalThis.window.localStorage.getItem("cart")).toBe("cart-shop-1");
    expect(isCredoLaunchReady("cart", shippingForm)).toBe(true);
  });

  test("generic checkout does not auto-pick a cart when multiple slug-scoped carts exist", () => {
    globalThis.window.localStorage.setItem("cart:shop-a", "cart-a");
    globalThis.window.localStorage.setItem("cart:shop-b", "cart-b");

    const shippingForm = createShippingForm();

    expect(resolveStoredCartId("cart")).toBeNull();
    expect(isCredoLaunchReady("cart", shippingForm)).toBe(false);
  });

  test("missing credo fields no longer block launch (falls back to iMall contact info)", () => {
    globalThis.window.localStorage.setItem("cart", "cart-global-1");

    const shippingForm = createShippingForm({ phone: "" });

    expect(getCredoLaunchBlockReason("cart", shippingForm)).toBeNull();
    expect(isCredoLaunchReady("cart", shippingForm)).toBe(true);
  });

  test("allows online installments for any non-empty cart, including multi-vendor", () => {
    expect(isOnlineInstallmentCartEligible([])).toBe(false);
    expect(isOnlineInstallmentCartEligible([{ tenantId: undefined }])).toBe(false);
    expect(isOnlineInstallmentCartEligible([{ tenantId: "shop-a" }])).toBe(true);
    expect(isOnlineInstallmentCartEligible([{ tenantId: "shop-a" }, { tenantId: "shop-a" }])).toBe(
      true,
    );
    expect(isOnlineInstallmentCartEligible([{ tenantId: "shop-a" }, { tenantId: "shop-b" }])).toBe(
      true,
    );
  });

  test("installment status polling is removed entirely", async () => {
    const source = await Bun.file(
      new URL("./use-checkout-controller.ts", import.meta.url),
    ).text();

    expect(source).not.toContain("installmentStatusQuery");
    expect(source).not.toContain("syncInstallmentCheckoutStatus");
    expect(source).not.toContain("refetchInterval");
  });

  test("clearing buy-now cart key does not clear default cart when IDs differ", () => {
    globalThis.window.localStorage.setItem("cart", "cart-default-1");
    globalThis.window.localStorage.setItem("cart:buy-now", "cart-buy-now-1");

    clearCheckoutCartKeys("cart:buy-now", "cart-buy-now-1");

    expect(globalThis.window.localStorage.getItem("cart")).toBe("cart-default-1");
    expect(globalThis.window.localStorage.getItem("cart:buy-now")).toBeNull();
  });

  test("clearing buy-now cart key clears default cart when IDs match", () => {
    globalThis.window.localStorage.setItem("cart", "cart-shared-1");
    globalThis.window.localStorage.setItem("cart:buy-now", "cart-shared-1");

    clearCheckoutCartKeys("cart:buy-now", "cart-shared-1");

    expect(globalThis.window.localStorage.getItem("cart")).toBeNull();
    expect(globalThis.window.localStorage.getItem("cart:buy-now")).toBeNull();
  });

  test("matching saved address can be refreshed when email or phone is missing", () => {
    const shippingForm = createShippingForm();

    expect(
      matchingAddressNeedsRefresh(
        {
          id: "address-1",
          label: null,
          firstName: "Giorgi",
          lastName: "Lomidze",
          email: null,
          phone: null,
          addressLine1: "Tbilisi",
          city: "Tbilisi",
          region: null,
          postalCode: null,
          country: "GE",
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        shippingForm,
      ),
    ).toBe(true);
  });
});
