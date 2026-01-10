import { Elysia } from "elysia";
import { authPlugin, bidPayloadSchema, env, listQuerySchema } from "./context";
import { auctionsRoutes, startAuctionCloser } from "./routes/auctions";
import { cartRoutes } from "./routes/carts";
import { inventoryRoutes } from "./routes/inventory";
import { allProductsRoutes, productsRoutes } from "./routes/products";
import { shopsRoutes } from "./routes/shops";

// Verify cartRoutes is loaded
if (cartRoutes) {
  console.log("[API] cartRoutes loaded: ✓");
} else {
  console.error("[API] cartRoutes failed to load: ✗");
}

const corsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Demo-User, X-Demo-Role",
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
  .use(authPlugin)
  .use(cartRoutes) // Single cart (can hold items from multiple shops) - register early to avoid conflicts
  .use(shopsRoutes)
  .use(allProductsRoutes)
  .use(productsRoutes)
  .use(inventoryRoutes)
  .use(auctionsRoutes)
  .onStart(() => {
    console.log("[API] Routes registered:");
    console.log("[API]   - /api/shops");
    console.log("[API]   - /api/products");
    console.log("[API]   - /api/carts");
    console.log("[API]   - /api/inventory");
    console.log("[API]   - /api/auctions");
  });

if (env.NODE_ENV !== "test") {
  startAuctionCloser();
  const port = env.PORT ?? 3001;
  app.listen(port);
  console.log(`API server running on http://localhost:${port}`);
  console.log("[API] Registered routes:");
  console.log("[API]   POST /api/carts");
  console.log("[API]   GET  /api/carts/:cartId");
  console.log("[API]   POST /api/carts/:cartId/items");
  console.log("[API]   POST /api/carts/:cartId/checkout");
}

export type App = typeof app;
export { bidPayloadSchema, listQuerySchema };
