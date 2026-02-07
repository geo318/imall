import { assets, db, tenants } from "@repo/db";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { authPlugin, getTenantIdBySlug, isSuperadminRequest } from "../context";
import { getStorage } from "../storage";
import { ensureAuth, requireAuth, verifyTenantAccess } from "../utils/auth";

async function isSellingEnabled(tenantId: string) {
  const [tenant] = await db
    .select({ canSell: tenants.canSell })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return Boolean(tenant?.canSell);
}

export const adminUploadRoutes = new Elysia({
  prefix: "/admin/:shopSlug/upload",
})
  .use(authPlugin)
  .post("/image", async ({ params, auth, request, set }) => {
    try {
      const { shopSlug } = params as { shopSlug: string };
      const tenantId = await getTenantIdBySlug(shopSlug);

      const superadmin = isSuperadminRequest(request);
      if (!superadmin) {
        // Use centralized auth utilities
        const effectiveAuth = await ensureAuth(auth, request);
        requireAuth(effectiveAuth);

        // Verify tenant access
        const hasAccess = effectiveAuth?.userId
          ? await verifyTenantAccess(effectiveAuth.userId, tenantId)
          : false;
        if (!hasAccess) {
          set.status = 403;
          return { error: "Forbidden: You don't have access to this shop" };
        }

        if (!(await isSellingEnabled(tenantId))) {
          set.status = 403;
          return { error: "Selling is disabled for this shop" };
        }
      }

      const storage = getStorage();

      // Read FormData directly from request (Elysia doesn't auto-parse FormData)
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const productId = formData.get("productId") as string | null;

      if (!file) {
        set.status = 400;
        return { error: "No file provided" };
      }

      // Validate image
      if (!file.type.startsWith("image/")) {
        set.status = 400;
        return { error: "File must be an image" };
      }

      // Upload file - use shopSlug and productId for folder organization
      // Structure: shopSlug/productId/filename (or shopSlug/filename if no productId)
      const storageKey = await storage.upload(file, shopSlug, productId || undefined);

      // Create asset record
      const [asset] = await db
        .insert(assets)
        .values({
          id: crypto.randomUUID(),
          tenantId,
          storageKey,
          mime: file.type,
          size: file.size,
        })
        .returning();

      if (!asset) {
        throw new Error("Failed to create asset record");
      }

      return {
        id: asset.id,
        url: storage.getUrl(storageKey),
        storageKey,
      };
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("[Admin Upload] Error:", error);
      set.status = 500;
      return {
        error: "Failed to upload image",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
