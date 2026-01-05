import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authPlugin, bidPayloadSchema, env, listQuerySchema } from "./context";
import { auctionsRoutes, startAuctionCloser } from "./routes/auctions";
import { cartRoutes } from "./routes/carts";
import { inventoryRoutes } from "./routes/inventory";
import { allProductsRoutes, productsRoutes } from "./routes/products";
import { shopsRoutes } from "./routes/shops";

const app = new Elysia({ prefix: "/api" })
  .use(
    cors({
      origin: true, // reflect request origin (dev + prod)
      credentials: true,
    }),
  )
  .use(authPlugin)
  .use(shopsRoutes)
  .use(allProductsRoutes)
  .use(productsRoutes)
  .use(inventoryRoutes)
  .use(cartRoutes)
  .use(auctionsRoutes);

if (env.NODE_ENV !== "test") {
  startAuctionCloser();
  const port = env.PORT ?? 3001;
  app.listen(port);
  console.log(`API server running on http://localhost:${port}`);
}

export type App = typeof app;
export { bidPayloadSchema, listQuerySchema };
