import "dotenv/config";
import { defineConfig } from "drizzle-kit";

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL is required for drizzle-kit (db:push/db:generate). Do not rely on app-wide env validation for migration tooling.",
    );
  }
  return value;
}

/**
 * Drizzle migration settings.
 * - schema: source of truth for table definitions
 * - out: where generated SQL migrations are stored (commit these)
 * - dbCredentials: reads DATABASE_URL directly from process.env/.env
 *   (avoid importing app env validation, which requires unrelated vars)
 */
export default defineConfig({
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: requireDatabaseUrl(),
  },
  verbose: true,
  strict: true,
});
