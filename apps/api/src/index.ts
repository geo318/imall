import { db } from "@repo/db";
import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { bidPayloadSchema, env, listQuerySchema } from "./context";
import { adminProductsRoutes } from "./routes/admin-products";
import { adminShopRoutes } from "./routes/admin-shops";
import { adminUploadRoutes } from "./routes/admin-upload";
import { auctionsRoutes, startAuctionCloser } from "./routes/auctions";
import { cartRoutes } from "./routes/carts";
import { categoriesRoutes } from "./routes/categories";
import { favoritesRoutes } from "./routes/favorites";
import { imageRoutes } from "./routes/images";
import { inventoryRoutes } from "./routes/inventory";
import { allProductsRoutes, productsRoutes } from "./routes/products";
import { shopsRoutes } from "./routes/shops";
import { superadminRoutes } from "./routes/superadmin";
import { startProductStatsQueue } from "./utils/product-stats-queue";

// Verify cartRoutes is loaded
if (cartRoutes) {
  console.log("[API] cartRoutes loaded: ✓");
} else {
  console.error("[API] cartRoutes failed to load: ✗");
}

const summarizeDatabaseUrl = (value: string | undefined) => {
  if (!value) return { present: false };

  try {
    const url = new URL(value);
    return {
      present: true,
      protocol: url.protocol.replace(":", ""),
      host: url.hostname || undefined,
      port: url.port || undefined,
      database: url.pathname.replace(/^\//, "") || undefined,
      sslmode: url.searchParams.get("sslmode") || undefined,
    };
  } catch {
    return { present: true, parseable: false };
  }
};

async function logStartupDiagnostics(port: number) {
  const start = Date.now();
  console.log("[API][BOOT] Step 1/4: Environment summary");
  console.log("[API][BOOT] NODE_ENV:", env.NODE_ENV);
  console.log("[API][BOOT] PORT:", port);
  console.log("[API][BOOT] DOMAIN:", env.DOMAIN);
  console.log("[API][BOOT] NEXT_PUBLIC_DOMAIN:", env.NEXT_PUBLIC_DOMAIN);
  console.log("[API][BOOT] DOMAIN set:", Boolean(env.DOMAIN));
  console.log("[API][BOOT] NEXT_PUBLIC_DOMAIN set:", Boolean(env.NEXT_PUBLIC_DOMAIN));
  console.log("[API][BOOT] DATABASE_URL:", summarizeDatabaseUrl(env.DATABASE_URL));

  console.log("[API][BOOT] Step 2/4: Database probe");
  try {
    const probe = (await db.execute(sql`
      select
        current_database() as database,
        current_schema() as schema,
        current_user as db_user,
        to_regclass('public.products')::text as products_table,
        to_regclass('public.tenants')::text as tenants_table,
        to_regclass('public.auctions')::text as auctions_table
    `)) as {
      rows?: Array<{
        database?: string;
        schema?: string;
        db_user?: string;
        products_table?: string | null;
        tenants_table?: string | null;
        auctions_table?: string | null;
      }>;
    };

    const row = probe.rows?.[0];
    const summary = {
      database: row?.database,
      schema: row?.schema,
      user: row?.db_user,
      productsTable: row?.products_table ?? null,
      tenantsTable: row?.tenants_table ?? null,
      auctionsTable: row?.auctions_table ?? null,
    };
    console.log("[API][BOOT] DB probe success:", summary);

    const missingCoreTables = [
      summary.productsTable ? null : "products",
      summary.tenantsTable ? null : "tenants",
    ].filter(Boolean) as string[];

    if (missingCoreTables.length > 0) {
      throw new Error(
        `Database schema is incomplete for API startup. Missing core tables: ${missingCoreTables.join(", ")}. Migration may have been aborted or DATABASE_URL points to the wrong database.`,
      );
    }
  } catch (error) {
    console.error("[API][BOOT] DB probe failed:", error);
    throw error;
  }

  console.log("[API][BOOT] Step 3/4: Route registration complete");
  console.log("[API][BOOT] Route prefix: /api");
  console.log("[API][BOOT] Step 4/4: Startup diagnostics complete in", `${Date.now() - start}ms`);
}

const corsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Superadmin-Email, X-Superadmin-Password",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
};

const app = new Elysia({ prefix: "/api" })
  .onBeforeHandle(({ request }) => {
    // Handle OPTIONS preflight requests - return Response to stop request chain
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("origin");
      const headers = corsHeaders(origin);
      return new Response(null, { status: 204, headers });
    }
  })
  .onAfterHandle(({ request, set }) => {
    // Apply CORS headers to all responses
    const origin = request.headers.get("origin");
    const headers = corsHeaders(origin);
    for (const [key, value] of Object.entries(headers)) {
      set.headers[key] = value;
    }
  })
  .use(cartRoutes) // Single cart (can hold items from multiple shops) - register early to avoid conflicts
  .use(imageRoutes) // Image serving - register early to avoid conflicts
  .use(shopsRoutes)
  .use(categoriesRoutes)
  .use(allProductsRoutes)
  .use(productsRoutes)
  .use(inventoryRoutes)
  .use(auctionsRoutes)
  .use(favoritesRoutes)
  .use(adminProductsRoutes)
  .use(adminShopRoutes)
  .use(adminUploadRoutes)
  .use(superadminRoutes)
  .onStart(() => {
    console.log("[API] Routes registered:");
    console.log("[API]   - /api/shops");
    console.log("[API]   - /api/categories/tree");
    console.log("[API]   - /api/products");
    console.log("[API]   - /api/carts");
    console.log("[API]   - /api/inventory");
    console.log("[API]   - /api/auctions");
  });

async function bootstrapApi() {
  const port = env.PORT ?? 3001;
  await logStartupDiagnostics(port);

  startAuctionCloser();
  startProductStatsQueue();
  app.listen(port);
  console.log("[API][BOOT] Listening:", {
    local: `http://localhost:${port}`,
    apiBase: `http://localhost:${port}/api`,
  });
  console.log("[API] Registered routes:");
  console.log("[API]   POST /api/carts");
  console.log("[API]   GET  /api/carts/:cartId");
  console.log("[API]   POST /api/carts/:cartId/items");
  console.log("[API]   POST /api/carts/:cartId/checkout");
}

if (env.NODE_ENV !== "test") {
  bootstrapApi().catch((error) => {
    console.error("[API][BOOT] Fatal startup error:", error);
    process.exit(1);
  });
}

export type App = typeof app;
export { bidPayloadSchema, listQuerySchema };
