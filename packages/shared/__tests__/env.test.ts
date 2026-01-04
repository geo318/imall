import { describe, expect, test } from "bun:test";
import { buildEnv } from "../src/env";

describe("env schemas", () => {
  test("parses valid env and coerces port", () => {
    const env = buildEnv({
      DOMAIN: "http://localhost:3001",
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      PORT: "4000",
      PAYMENT_KEEPZ_API_KEY: "test-key",
      NEXT_PUBLIC_DOMAIN: "http://localhost:3001",
    });

    expect(env.DOMAIN).toBe("http://localhost:3001");
    expect(env.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/db");
    expect(env.PORT).toBe(4000);
    expect(env.PAYMENT_KEEPZ_API_KEY).toBe("test-key");
    expect(env.NEXT_PUBLIC_DOMAIN).toBe("http://localhost:3001");
  });

  test("throws when required env is missing", () => {
    expect(() =>
      buildEnv({
        DOMAIN: "http://localhost:3001",
        NEXT_PUBLIC_DOMAIN: "http://localhost:3001",
        // Missing DATABASE_URL
      }),
    ).toThrow();
  });
});
