import { describe, expect, test } from "bun:test";
import { loadClientEnv, loadServerEnv } from "../src/env";

describe("env schemas", () => {
  test("parses valid server env and coerces port", () => {
    const env = loadServerEnv({
      DOMAIN: "http://localhost:3001",
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      PORT: "4000",
      PAYMENT_KEEPZ_API_KEY: "test-key",
    });

    expect(env.DOMAIN).toBe("http://localhost:3001");
    expect(env.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/db");
    expect(env.PORT).toBe(4000);
    expect(env.PAYMENT_KEEPZ_API_KEY).toBe("test-key");
  });

  test("throws when required server env is missing", () => {
    expect(() =>
      loadServerEnv({
        DOMAIN: "http://localhost:3001",
        // Missing DATABASE_URL
      } as any),
    ).toThrow();
  });

  test("parses valid client env", () => {
    const env = loadClientEnv({
      NEXT_PUBLIC_DOMAIN: "http://localhost:3001",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test",
    });

    expect(env.NEXT_PUBLIC_DOMAIN).toBe("http://localhost:3001");
    expect(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).toBe("pk_test");
  });
});
