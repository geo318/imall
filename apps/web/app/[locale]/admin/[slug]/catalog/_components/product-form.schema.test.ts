import { describe, expect, test } from "bun:test";
import { productFormSchema, variantSchema } from "./product-form.schema";

describe("product form inventory defaults", () => {
  test("defaults variants to infinite stock tracking when mode is omitted", () => {
    const variant = variantSchema.parse({
      price: "19.99",
      currency: "GEL",
    });

    expect(variant.trackInventory).toBe(false);
  });

  test("preserves variant ids for edit flows", () => {
    const variant = variantSchema.parse({
      id: "variant-1",
      price: "19.99",
      currency: "GEL",
      trackInventory: true,
      stock: "4",
    });

    expect(variant.id).toBe("variant-1");
    expect(variant.trackInventory).toBe(true);
    expect(variant.stock).toBe("4");
  });

  test("accepts products that rely on infinite stock by default", () => {
    const product = productFormSchema.parse({
      title: "Infinite tee",
      category: "apparel",
      variants: [
        {
          price: "29.99",
          currency: "GEL",
        },
      ],
    });

    expect(product.variants[0]?.trackInventory).toBe(false);
    expect(product.variants[0]?.stock).toBeUndefined();
  });
});
