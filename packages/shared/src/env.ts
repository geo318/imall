import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const serverSchema = {
  DOMAIN: z.string().url(),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CLERK_JWT_PUBLIC_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string(),
  DB_POOL_MAX: z.coerce.number().int().positive().max(50).default(5),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  PAYMENT_KEEPZ_API_KEY: z.string().optional(),
  KEEPZ_ECOMMERCE_BASE_URL: z.string().url().optional(),
  KEEPZ_INTEGRATOR_IDENTIFIER: z.string().uuid().optional(),
  KEEPZ_INTEGRATOR_ID: z.string().uuid().optional(),
  KEEPZ_RECEIVER_ID: z.string().uuid().optional(),
  KEEPZ_RSA_PUBLIC_KEY: z.string().optional(),
  KEEPZ_RSA_PRIVATE_KEY: z.string().optional(),
  KEEPZ_DEFAULT_DIRECT_LINK_PROVIDER: z.enum(["DEFAULT", "BOG", "TBC", "CREDO"]).optional(),
  KEEPZ_DEFAULT_LANGUAGE: z.enum(["EN", "IT", "KA"]).optional(),
  KEEPZ_CALLBACK_URL: z.string().url().optional(),
  KEEPZ_MIN_ORDER_AMOUNT: z.coerce.number().positive().optional(),
  KEEPZ_MAX_ORDER_AMOUNT: z.coerce.number().positive().optional(),
  KEEPZ_DIRECT_SETTLEMENTS_BASE_URL: z.string().url().optional(),
  KEEPZ_DIRECT_SETTLEMENTS_CLIENT_ID: z.string().uuid().optional(),
  KEEPZ_DIRECT_SETTLEMENTS_CLIENT_SECRET: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  CREDO_MERCHANT_ID: z.string().optional(),
  CREDO_SHARED_SECRET: z.string().optional(),
  CREDO_RSA_PUBLIC_KEY: z.string().optional(),
  CREDO_RSA_PRIVATE_KEY: z.string().optional(),
  CREDO_WIDGET_ORDER_URL: z.string().url().optional(),
  CREDO_WIDGET_STATUS_URL: z.string().url().optional(),
  CREDO_INSTALLMENT_DEFAULT_MONTHS: z.coerce.number().int().positive().max(60).default(12),
  CREDO_ADDITIONAL_API_BASE_URL: z.string().url().optional(),
  CREDO_ADDITIONAL_USERNAME: z.string().optional(),
  CREDO_ADDITIONAL_PASSWORD: z.string().optional(),
  SEED_SHOP_SLUG: z.string().default("demo-shop"),
  SEED_SHOP_NAME: z.string().default("Demo Shop"),
  SUPERADMIN_EMAIL: z.string().email(),
  SUPERADMIN_PASSWORD: z.string().min(1),
  IMAGE_STORAGE_PROVIDER: z.enum(["local", "cloudinary"]).optional(),
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_BASE_FOLDER: z.string().optional(),
  CLOUDINARY_DELIVERY_TRANSFORMATION: z.string().optional(),
  BACKEND_URL: z.preprocess((value) => {
    if (typeof value === "string" && value.length > 0 && !/^https?:\/\//i.test(value)) {
      return `http://${value}`;
    }
    return value;
  }, z.string().url().default("http://localhost:3001")),
} as const;

const clientSchema = {
  NEXT_PUBLIC_DOMAIN: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().url().optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().url().optional(),
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().url().optional(),
  NEXT_PUBLIC_BACKEND_URL: z.string().url().optional(),
} as const;

type RuntimeEnv = Record<string, string | undefined>;

const runtimeEnv: RuntimeEnv = {
  DOMAIN: process.env.DOMAIN,
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  CLERK_JWT_PUBLIC_KEY: process.env.CLERK_JWT_PUBLIC_KEY,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
  DB_POOL_MAX: process.env.DB_POOL_MAX,
  DB_POOL_IDLE_TIMEOUT_MS: process.env.DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_CONNECTION_TIMEOUT_MS: process.env.DB_POOL_CONNECTION_TIMEOUT_MS,
  PAYMENT_KEEPZ_API_KEY: process.env.PAYMENT_KEEPZ_API_KEY,
  KEEPZ_ECOMMERCE_BASE_URL: process.env.KEEPZ_ECOMMERCE_BASE_URL,
  KEEPZ_INTEGRATOR_IDENTIFIER: process.env.KEEPZ_INTEGRATOR_IDENTIFIER,
  KEEPZ_INTEGRATOR_ID: process.env.KEEPZ_INTEGRATOR_ID,
  KEEPZ_RECEIVER_ID: process.env.KEEPZ_RECEIVER_ID,
  KEEPZ_RSA_PUBLIC_KEY: process.env.KEEPZ_RSA_PUBLIC_KEY,
  KEEPZ_RSA_PRIVATE_KEY: process.env.KEEPZ_RSA_PRIVATE_KEY,
  KEEPZ_DEFAULT_DIRECT_LINK_PROVIDER: process.env.KEEPZ_DEFAULT_DIRECT_LINK_PROVIDER,
  KEEPZ_DEFAULT_LANGUAGE: process.env.KEEPZ_DEFAULT_LANGUAGE,
  KEEPZ_CALLBACK_URL: process.env.KEEPZ_CALLBACK_URL,
  KEEPZ_MIN_ORDER_AMOUNT: process.env.KEEPZ_MIN_ORDER_AMOUNT,
  KEEPZ_MAX_ORDER_AMOUNT: process.env.KEEPZ_MAX_ORDER_AMOUNT,
  KEEPZ_DIRECT_SETTLEMENTS_BASE_URL: process.env.KEEPZ_DIRECT_SETTLEMENTS_BASE_URL,
  KEEPZ_DIRECT_SETTLEMENTS_CLIENT_ID: process.env.KEEPZ_DIRECT_SETTLEMENTS_CLIENT_ID,
  KEEPZ_DIRECT_SETTLEMENTS_CLIENT_SECRET: process.env.KEEPZ_DIRECT_SETTLEMENTS_CLIENT_SECRET,
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
  CREDO_MERCHANT_ID: process.env.CREDO_MERCHANT_ID,
  CREDO_SHARED_SECRET: process.env.CREDO_SHARED_SECRET,
  CREDO_RSA_PUBLIC_KEY: process.env.CREDO_RSA_PUBLIC_KEY,
  CREDO_RSA_PRIVATE_KEY: process.env.CREDO_RSA_PRIVATE_KEY,
  CREDO_WIDGET_ORDER_URL: process.env.CREDO_WIDGET_ORDER_URL,
  CREDO_WIDGET_STATUS_URL: process.env.CREDO_WIDGET_STATUS_URL,
  CREDO_INSTALLMENT_DEFAULT_MONTHS: process.env.CREDO_INSTALLMENT_DEFAULT_MONTHS,
  CREDO_ADDITIONAL_API_BASE_URL: process.env.CREDO_ADDITIONAL_API_BASE_URL,
  CREDO_ADDITIONAL_USERNAME: process.env.CREDO_ADDITIONAL_USERNAME,
  CREDO_ADDITIONAL_PASSWORD: process.env.CREDO_ADDITIONAL_PASSWORD,
  SEED_SHOP_SLUG: process.env.SEED_SHOP_SLUG,
  SEED_SHOP_NAME: process.env.SEED_SHOP_NAME,
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD,
  IMAGE_STORAGE_PROVIDER: process.env.IMAGE_STORAGE_PROVIDER,
  CLOUDINARY_URL: process.env.CLOUDINARY_URL,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  CLOUDINARY_BASE_FOLDER: process.env.CLOUDINARY_BASE_FOLDER,
  CLOUDINARY_DELIVERY_TRANSFORMATION: process.env.CLOUDINARY_DELIVERY_TRANSFORMATION,
  BACKEND_URL: process.env.BACKEND_URL,
  NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL:
    process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
};

export function buildEnv(input: RuntimeEnv) {
  const skipValidation =
    Boolean(input.SKIP_ENV_VALIDATION) ||
    input.NODE_ENV === "test" ||
    process.env.NEXT_PHASE === "phase-production-build";
  return createEnv({
    server: serverSchema,
    client: clientSchema,
    isServer: !globalThis.window,
    clientPrefix: "NEXT_PUBLIC_",
    emptyStringAsUndefined: true,
    skipValidation,
    runtimeEnv: input,
  });
}

export const env = buildEnv(runtimeEnv);

export type ServerEnv = Pick<typeof env, keyof typeof serverSchema>;
export type ClientEnv = Pick<typeof env, keyof typeof clientSchema>;
