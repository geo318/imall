import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { env } from "./packages/shared/src/env";

/**
 * Drizzle migration settings.
 * - schema: source of truth for table definitions
 * - out: where generated SQL migrations are stored (commit these)
 * - dbCredentials: uses DATABASE_URL from .env (fallback for local dev)
 */
export default defineConfig({
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
