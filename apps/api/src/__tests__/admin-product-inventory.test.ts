import { describe, expect, test } from "bun:test";
import { resolveStockQty, resolveTrackInventory } from "../utils/admin-product-inventory";

describe("admin product inventory helpers", () => {
  test("defaults standard variants to infinite stock when nothing is provided", () => {
    const variant = {};

    expect(resolveTrackInventory(variant, false)).toBe(false);
    expect(resolveStockQty(variant, false, false)).toBe(0);
  });

  test("enables tracked inventory when stock is provided without an explicit mode", () => {
    const variant = { stock: "7" };
    const trackInventory = resolveTrackInventory(variant, false);

    expect(trackInventory).toBe(true);
    expect(resolveStockQty(variant, false, trackInventory)).toBe(7);
  });

  test("keeps explicit infinite stock even if a stale stock value is present", () => {
    const variant = { stock: "12", trackInventory: false };
    const trackInventory = resolveTrackInventory(variant, false);

    expect(trackInventory).toBe(false);
    expect(resolveStockQty(variant, false, trackInventory)).toBe(0);
  });

  test("forces auction variants into tracked inventory mode with zero editable stock", () => {
    const variant = { stock: "9", trackInventory: false };
    const trackInventory = resolveTrackInventory(variant, true);

    expect(trackInventory).toBe(true);
    expect(resolveStockQty(variant, true, trackInventory)).toBe(0);
  });

  test("floors decimal stock and rejects non-positive values", () => {
    expect(resolveStockQty({ stock: "4.9" }, false, true)).toBe(4);
    expect(resolveStockQty({ stock: "0" }, false, true)).toBe(0);
    expect(resolveStockQty({ stock: "-3" }, false, true)).toBe(0);
  });
});
