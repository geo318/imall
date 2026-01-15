import { beforeAll, describe, expect, test } from "bun:test";

let listQuerySchema: typeof import("../index.js").listQuerySchema;
let bidPayloadSchema: typeof import("../index.js").bidPayloadSchema;

beforeAll(async () => {
  process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/testdb";
  process.env.DOMAIN ??= "http://localhost:3001";
  process.env.NODE_ENV ??= "test";
  const mod = await import("../index.js");
  listQuerySchema = mod.listQuerySchema;
  bidPayloadSchema = mod.bidPayloadSchema;
});

describe("listQuerySchema", () => {
  test("defaults limit when missing", () => {
    const parsed = listQuerySchema.parse({});
    expect(parsed.limit).toBe(50);
  });

  test("parses and caps valid limit", () => {
    const parsed = listQuerySchema.parse({ limit: "25" });
    expect(parsed.limit).toBe(25);
  });

  test("rejects invalid limit", () => {
    expect(() => listQuerySchema.parse({ limit: "0" })).toThrow();
    expect(() => listQuerySchema.parse({ limit: "201" })).toThrow();
  });
});

describe("bidPayloadSchema", () => {
  test("accepts string/number amounts > 0", () => {
    const bidderId = "00000000-0000-0000-0000-000000000001";
    expect(bidPayloadSchema.parse({ amount: "10.50", bidderId }).amount).toBe(10.5);
    expect(bidPayloadSchema.parse({ amount: 5, bidderId }).amount).toBe(5);
  });

  test("rejects non-positive amounts", () => {
    const bidderId = "00000000-0000-0000-0000-000000000001";
    expect(() => bidPayloadSchema.parse({ amount: "0", bidderId })).toThrow();
    expect(() => bidPayloadSchema.parse({ amount: -1, bidderId })).toThrow();
    expect(() => bidPayloadSchema.parse({ amount: "abc", bidderId })).toThrow();
  });

  test("accepts payload without bidderId (backend gets it from auth token)", () => {
    // bidderId is optional - backend extracts it from the auth token
    const result = bidPayloadSchema.parse({ amount: 10 });
    expect(result.amount).toBe(10);
    expect(result.bidderId).toBeUndefined();
  });

  test("rejects invalid bidderId uuid when provided", () => {
    expect(() =>
      bidPayloadSchema.parse({
        amount: 10,
        bidderId: "not-a-uuid",
      }),
    ).toThrow();
  });
});
