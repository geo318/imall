import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

// Import the schema to ensure tables are registered in migrations
import * as schema from './schema';

/**
 * Database client creation for node environments.
 *
 * This client connects to a Postgres instance using a connection
 * string provided in the environment variable `DATABASE_URL`. When
 * writing your application code, import `db` from this package to
 * run queries. See the schema definitions in `schema.ts` for the
 * available tables.
 */
const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL environment variable is missing. Please set it in your environment or .env file.'
  );
}

// Create a pooled Postgres client. The pool will manage its own
// connections for efficiency. If you need advanced configuration,
// replace this with your own Pool instance.
const pool = new Pool({ connectionString: DATABASE_URL });

// Initialize drizzle using the node-postgres dialect. The drizzle
// instance exposes a query API with full type-safety based on your
// schema definitions.
export const db = drizzle(pool, { schema });

export * from './schema';