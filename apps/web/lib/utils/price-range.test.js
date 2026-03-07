import { describe, expect, test } from "bun:test";
import { clampPriceRange, derivePriceBounds, getProductMinPrice } from "./price-range";

function createProduct(prices) {
  return {
    id: `p-${prices.join("-")}`,
    slug: "test",
    title: "Test",
    description: null,
    variants: prices.map((price, index) => ({
      id: `v-${index}`,
      sku: null,
      price,
      currency: "GEL",
    })),
  };
}

describe("price-range utils", () => {
  test("getProductMinPrice returns lowest variant price", () => {
    const product = createProduct(["129.99", "90", "199"]);
    expect(getProductMinPrice(product)).toBe(90);
  });

  test("derivePriceBounds returns floor/ceil bounds", () => {
    const products = [createProduct(["100.4"]), createProduct(["299.9"]), createProduct(["55.2"])];
    expect(derivePriceBounds(products)).toEqual([55, 300]);
  });

  test("clampPriceRange keeps selection inside bounds", () => {
    expect(clampPriceRange([0, 999], [120, 540])).toEqual([120, 540]);
  });
});
