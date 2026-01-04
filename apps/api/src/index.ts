import { Elysia } from "elysia";
import { authPlugin, env, bidPayloadSchema, listQuerySchema } from "./context";
import { productsRoutes } from "./routes/products";
import { inventoryRoutes } from "./routes/inventory";
import { cartRoutes } from "./routes/carts";
import { auctionsRoutes, startAuctionCloser } from "./routes/auctions";

const app = new Elysia({ prefix: "/api" })
	.use(authPlugin)
	.use(productsRoutes)
	.use(inventoryRoutes)
	.use(cartRoutes)
	.use(auctionsRoutes);

if (process.env.NODE_ENV !== "test") {
	startAuctionCloser();
	const port = env.PORT ?? 3001;
	app.listen(port);
	console.log(`API server running on http://localhost:${port}`);
}

export type App = typeof app;
export { bidPayloadSchema, listQuerySchema };
