import { expect, test } from "bun:test";
import { updateAddressSchema } from "../routes/user-addresses";

test("address updates distinguish clearing optional fields from leaving them unchanged", () => {
  expect(updateAddressSchema.parse({ region: "", postalCode: null })).toEqual({
    region: null,
    postalCode: null,
  });
  expect(updateAddressSchema.parse({ firstName: " Test " })).toEqual({ firstName: "Test" });
  expect(updateAddressSchema.safeParse({}).success).toBe(false);
  expect(updateAddressSchema.safeParse({ email: "bad-email" }).success).toBe(false);
});
