import "dotenv/config";
import { defineConfig } from "drizzle-kit";

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
		url:
			process.env.DATABASE_URL ??
			"postgres://postgres:postgres@localhost:5432/myshop",
	},
	verbose: true,
	strict: true,
});
