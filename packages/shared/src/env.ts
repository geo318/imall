import { z } from 'zod';

/**
 * Environment schema using zod. This schema validates both server and
 * client environment variables. When adding new variables, extend
 * `ServerEnv` or `ClientEnv` as appropriate. For Next.js, values
 * prefixed with `NEXT_PUBLIC_` are exposed to the client.
 */

const ServerEnvSchema = z.object({
  /** The base domain for the application, e.g. `https://example.com`. */
  DOMAIN: z.string().url(),
  /** The connection string for Postgres. */
  DATABASE_URL: z.string().url(),
  /** HTTP port for the API server (defaults to 3001 when unset). */
  PORT: z.coerce.number().int().positive().optional(),
  /** Clerk public key for verifying JWTs (roles to be added later). */
  CLERK_JWT_PUBLIC_KEY: z.string().optional(),
  /** Clerk secret key for server-side operations. */
  CLERK_SECRET_KEY: z.string().optional(),
  /** Payments: keepz.me access token (interface will support more providers). */
  PAYMENT_KEEPZ_API_KEY: z.string().optional(),
  /** Generic webhook secret for payment/fulfillment callbacks. */
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
});

const ClientEnvSchema = z.object({
  /** Client‑side domain, should mirror `DOMAIN` without secrets. */
  NEXT_PUBLIC_DOMAIN: z.string().url(),
  /** Clerk publishable key for frontend auth. */
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type ClientEnv = z.infer<typeof ClientEnvSchema>;

/**
 * Parse and validate server environment variables at startup. Throws
 * if any required variable is missing or invalid. For Bun, this is
 * executed in the API server; for Next.js, the server runtime can
 * also import this function to validate on start.
 */
export function loadServerEnv(env: NodeJS.ProcessEnv): ServerEnv {
  return ServerEnvSchema.parse(env);
}

/**
 * Parse and validate client environment variables. Use this in the
 * Next.js frontend to ensure client variables are present.
 */
export function loadClientEnv(env: NodeJS.ProcessEnv): ClientEnv {
  return ClientEnvSchema.parse(env);
}
