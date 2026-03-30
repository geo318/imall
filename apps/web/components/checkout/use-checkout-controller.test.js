import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EMPTY_SHIPPING_FORM } from "./types";
import {
  getCredoLaunchBlockReason,
  isCredoLaunchReady,
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

  test("reports missing customer data when cart exists but required credo fields are incomplete", () => {
    globalThis.window.localStorage.setItem("cart", "cart-global-1");

    const shippingForm = createShippingForm({ phone: "" });

    expect(getCredoLaunchBlockReason("cart", shippingForm)).toBe("missingCustomerData");
    expect(isCredoLaunchReady("cart", shippingForm)).toBe(false);
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
