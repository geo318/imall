import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const serverSchema = {
  DOMAIN: z.string().url(),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLERK_JWT_PUBLIC_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string(),
  PAYMENT_KEEPZ_API_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  SEED_SHOP_SLUG: z.string().default("demo-shop"),
  SEED_SHOP_NAME: z.string().default("Demo Shop"),
  BACKEND_URL: z.string().url().default("http://localhost:3001"),
} as const;

const clientSchema = {
  NEXT_PUBLIC_DOMAIN: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
} as const;

type RuntimeEnv = Record<string, string | undefined>;

const runtimeEnv: RuntimeEnv = {
  DOMAIN: process.env.DOMAIN,
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  CLERK_JWT_PUBLIC_KEY: process.env.CLERK_JWT_PUBLIC_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  PAYMENT_KEEPZ_API_KEY: process.env.PAYMENT_KEEPZ_API_KEY,
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
  SEED_SHOP_SLUG: process.env.SEED_SHOP_SLUG,
  SEED_SHOP_NAME: process.env.SEED_SHOP_NAME,
  BACKEND_URL: process.env.BACKEND_URL,
  NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
};

export function buildEnv(runtimeEnv: RuntimeEnv) {
  return createEnv({
    server: serverSchema,
    client: clientSchema,
    runtimeEnv,
    isServer: typeof window === "undefined",
    clientPrefix: "NEXT_PUBLIC_",
    skipValidation: Boolean(runtimeEnv.SKIP_ENV_VALIDATION) || runtimeEnv.NODE_ENV === "test",
    emptyStringAsUndefined: true,
  });
}

export const env = buildEnv(runtimeEnv);

export type ServerEnv = Pick<typeof env, keyof typeof serverSchema>;
export type ClientEnv = Pick<typeof env, keyof typeof clientSchema>;
