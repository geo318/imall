import { env } from "@repo/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Import the schema to ensure tables are registered in migrations
import * as schema from "./schema";

/**
 * Database client creation for node environments.
 *
 * This client connects to a Postgres instance using a connection
 * string provided in the environment variable `DATABASE_URL`. When
 * writing your application code, import `db` from this package to
 * run queries. See the schema definitions in `schema.ts` for the
 * available tables.
 */
// Create a pooled Postgres client. The pool will manage its own
// connections for efficiency. If you need advanced configuration,
// replace this with your own Pool instance.
const pool = new Pool({ connectionString: env.DATABASE_URL });

// Initialize drizzle using the node-postgres dialect. The drizzle
// instance exposes a query API with full type-safety based on your
// schema definitions.
export const db = drizzle(pool, { schema });

export * from "./schema";
