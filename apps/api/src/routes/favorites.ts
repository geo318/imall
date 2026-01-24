import { assets, db, favorites, productImages, products, tenants, users, variants } from "@repo/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import { authPlugin } from "../context";
import { getStorage } from "../storage";
import { ensureAuth, requireAuth } from "../utils/auth";

type FavoriteRow = {
  productId: string;
  createdAt: Date;
};

type VariantRow = {
  id: string;
  productId: string;
  price: string;
  currency: string;
};

type ImageRow = {
  id: string;
  productId: string;
  assetId: string | null;
  sortOrder: number | null;
};

type FavoriteRouteParams = {
  productId: string;
};

export const favoritesRoutes = new Elysia({
  prefix: "/favorites",
})
  .use(authPlugin)
  .get("/", async ({ auth, request, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      requireAuth(effectiveAuth);

      // Get user by externalAuthId (Clerk user ID)
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalAuthId, effectiveAuth?.userId ?? ""))
        .limit(1);

      if (!user) {
        return { items: [] };
      }

      // Get favorite products
      const favoriteRows = (await db
        .select({
          productId: favorites.productId,
          createdAt: favorites.createdAt,
        })
        .from(favorites)
        .where(eq(favorites.userId, user.id))) as FavoriteRow[];

      const productIds = favoriteRows.map((f) => f.productId);

      if (productIds.length === 0) {
        return { items: [] };
      }

      // Get product details with tenant info
      const productRows = await db
        .select({
          id: products.id,
          slug: products.slug,
          title: products.title,
          description: products.description,
          tenantId: products.tenantId,
          tenantSlug: tenants.shopSlug,
          tenantName: tenants.name,
        })
        .from(products)
        .innerJoin(tenants, eq(products.tenantId, tenants.id))
        .where(and(inArray(products.id, productIds), isNull(products.deletedAt)));

      if (!productRows || productRows.length === 0) {
        return { items: [] };
      }

      // Get variants for price
      const variantRows = (await db
        .select({
          id: variants.id,
          productId: variants.productId,
          price: variants.price,
          currency: variants.currency,
        })
        .from(variants)
        .where(inArray(variants.productId, productIds))) as VariantRow[];

      // Get images
      const imageRows = (await db
        .select({
          id: productImages.id,
          productId: productImages.productId,
          assetId: productImages.assetId,
          sortOrder: productImages.sortOrder,
        })
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.sortOrder))) as ImageRow[];

      // Get assets for image URLs
      const assetIds = imageRows
        .map((img) => img.assetId)
        .filter((id): id is string => Boolean(id));
      const assetRows =
        assetIds.length > 0
          ? await db.select().from(assets).where(inArray(assets.id, assetIds))
          : [];

      const storage = getStorage();

      // Build response - ensure all values are properly defined
      const items = productRows
        .filter((product) => product?.id && product.slug && product.title)
        .map((product) => {
          const productVariants = variantRows.filter((v) => v && v.productId === product.id);
          const productImagesData = imageRows.filter((img) => img && img.productId === product.id);
          const favorite = favoriteRows.find((f) => f && f.productId === product.id);

          // Get primary image
          const primaryImage = productImagesData[0];
          const primaryAssetId = primaryImage?.assetId;
          const primaryAsset = primaryAssetId
            ? assetRows.find((a) => a && a.id === primaryAssetId)
            : null;
          const imageUrl = primaryAsset?.storageKey
            ? storage.getUrl(primaryAsset.storageKey)
            : null;

          return {
            id: product.id,
            slug: product.slug,
            title: product.title || "",
            description: product.description || null,
            tenantSlug: product.tenantSlug || "",
            tenantName: product.tenantName || "",
            price: productVariants[0]?.price || "0.00",
            currency: productVariants[0]?.currency || "USD",
            imageUrl: imageUrl || null,
            favoritedAt: favorite?.createdAt
              ? favorite.createdAt instanceof Date
                ? favorite.createdAt.toISOString()
                : String(favorite.createdAt)
              : null,
          };
        });

      return { items };
    } catch (error) {
      console.error("[Favorites] Error fetching favorites:", error);
      if (error instanceof Response) return error;
      set.status = 500;
      return {
        error: "Failed to fetch favorites",
        message: error instanceof Error ? error.message : "Internal server error",
      };
    }
  })
  .post("/:productId", async ({ params, auth, request, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      requireAuth(effectiveAuth);

      // Get user by externalAuthId (Clerk user ID)
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalAuthId, effectiveAuth?.userId ?? ""))
        .limit(1);

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      const productId = (params as FavoriteRouteParams).productId;

      // Check if already favorited
      const [existing] = await db
        .select()
        .from(favorites)
        .where(and(eq(favorites.userId, user.id), eq(favorites.productId, productId)))
        .limit(1);

      if (existing) {
        return { message: "Already favorited" };
      }

      // Add to favorites
      await db.insert(favorites).values({
        id: crypto.randomUUID(),
        userId: user.id,
        productId,
      });

      // Track in stats
      const { trackProductLoved } = await import("../utils/product-stats");
      await trackProductLoved(productId);

      set.status = 201;
      return { success: true };
    } catch (error) {
      console.error("[Favorites] Error adding favorite:", error);
      if (error instanceof Response) return error;
      set.status = 500;
      return {
        error: "Failed to add favorite",
        message: error instanceof Error ? error.message : "Internal server error",
      };
    }
  })
  .delete("/:productId", async ({ params, auth, request, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      requireAuth(effectiveAuth);

      // Get user by externalAuthId (Clerk user ID)
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalAuthId, effectiveAuth?.userId ?? ""))
        .limit(1);

      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }

      const productId = (params as FavoriteRouteParams).productId;

      // Remove from favorites
      await db
        .delete(favorites)
        .where(and(eq(favorites.userId, user.id), eq(favorites.productId, productId)));

      return { success: true };
    } catch (error) {
      console.error("[Favorites] Error removing favorite:", error);
      if (error instanceof Response) return error;
      set.status = 500;
      return {
        error: "Failed to remove favorite",
        message: error instanceof Error ? error.message : "Internal server error",
      };
    }
  })
  .get("/check/:productId", async ({ params, auth, request, set }) => {
    try {
      const effectiveAuth = await ensureAuth(auth, request);
      requireAuth(effectiveAuth);

      // Get user by externalAuthId (Clerk user ID)
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.externalAuthId, effectiveAuth?.userId ?? ""))
        .limit(1);

      if (!user) {
        return { isFavorited: false };
      }

      const productId = (params as FavoriteRouteParams).productId;
      // Check if favorited
      const [favorite] = await db
        .select()
        .from(favorites)
        .where(and(eq(favorites.userId, user.id), eq(favorites.productId, productId)))
        .limit(1);

      return { isFavorited: !!favorite };
    } catch (error) {
      console.error("[Favorites] Error checking favorite:", error);
      if (error instanceof Response) return error;
      set.status = 500;
      return {
        error: "Failed to check favorite",
        message: error instanceof Error ? error.message : "Internal server error",
      };
    }
  });
