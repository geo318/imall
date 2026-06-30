import { describe, expect, test } from "bun:test";
import { applyCredoCustomerFallbacks, getMissingCredoCustomerFields } from "../routes/carts";

describe("Credo checkout validation", () => {
  test("reports every required customer field that is blank", () => {
    expect(
      getMissingCredoCustomerFields({
        provider: "credo",
        paymentType: "installments",
        clientFullName: " ",
        mobile: "+995599123456",
        email: undefined,
        factAddress: "",
      }),
    ).toEqual(["clientFullName", "email", "factAddress"]);
  });

  test("does not apply Credo customer requirements to Keepz", () => {
    expect(
      getMissingCredoCustomerFields({
        provider: "keepz",
        paymentType: "installments",
      }),
    ).toEqual([]);
  });

  test("backfills blank Credo customer fields with iMall contact info", () => {
    const filled = applyCredoCustomerFallbacks({
      provider: "credo",
      paymentType: "installments",
      clientFullName: " ",
      mobile: undefined,
      email: "",
      factAddress: undefined,
    });

    expect(filled.clientFullName).toBe("iMall Support");
    expect(filled.mobile).toBe("595000000");
    expect(filled.email).toBe("contact@imall.ge");
    expect(filled.factAddress).toBe("Kostava Ave. 4, Tbilisi, Georgia 0105");
  });

  test("leaves Keepz payloads untouched", () => {
    const payload = { provider: "keepz" as const, paymentType: "installments" as const };
    expect(applyCredoCustomerFallbacks(payload)).toEqual(payload);
  });
});
