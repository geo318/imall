import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const serverSchema = {
  DOMAIN: z.string().url(),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLERK_JWT_PUBLIC_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  PAYMENT_KEEPZ_API_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  SEED_SHOP_SLUG: z.string().default("demo-shop"),
  SEED_SHOP_NAME: z.string().default("Demo Shop"),
} as const;

const clientSchema = {
  NEXT_PUBLIC_DOMAIN: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
} as const;

type RuntimeEnv = Record<string, string | undefined>;

export function buildEnv(runtimeEnv: RuntimeEnv) {
  return createEnv({
    server: serverSchema,
    client: clientSchema,
    runtimeEnv,
    clientPrefix: "NEXT_PUBLIC_",
    skipValidation: Boolean(runtimeEnv.SKIP_ENV_VALIDATION) || runtimeEnv.NODE_ENV === "test",
    emptyStringAsUndefined: true,
  });
}

export const env = buildEnv(process.env);

export type ServerEnv = Pick<typeof env, keyof typeof serverSchema>;
export type ClientEnv = Pick<typeof env, keyof typeof clientSchema>;
