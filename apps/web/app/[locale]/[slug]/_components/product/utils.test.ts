import { describe, expect, test } from "bun:test";
import { getStockStatus } from "./utils";

describe("product inventory status", () => {
  test("treats infinite-stock variants as in stock", () => {
    expect(getStockStatus(undefined, false)).toBe("in_stock");
  });

  test("returns unknown when tracked inventory has no quantity yet", () => {
    expect(getStockStatus(undefined, true)).toBe("unknown");
  });

  test("marks tracked zero stock as sold out", () => {
    expect(getStockStatus(0, true)).toBe("sold");
  });

  test("marks low tracked inventory correctly", () => {
    expect(getStockStatus(3, true)).toBe("low");
  });

  test("marks healthy tracked inventory as in stock", () => {
    expect(getStockStatus(15, true)).toBe("in_stock");
  });
});
