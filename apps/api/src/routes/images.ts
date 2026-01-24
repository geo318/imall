import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { Elysia } from "elysia";

/**
 * Get the uploads directory path
 */
function getUploadsDir(): string {
  const currentDir = process.cwd();
  let apiSrcDir: string;

  // Find API src directory
  if (currentDir.includes("apps/api")) {
    // We're in apps/api, resolve to src/uploads
    apiSrcDir = resolve(currentDir, "src");
  } else if (currentDir.includes("apps/web")) {
    // We're in apps/web, go up and into api/src
    apiSrcDir = resolve(currentDir, "..", "api", "src");
  } else {
    // Assume we're at workspace root
    apiSrcDir = resolve(currentDir, "apps", "api", "src");
  }

  return resolve(apiSrcDir, "uploads");
}

/**
 * Image serving route
 * Serves images from the uploads directory
 * Route: /api/image/:slug/[...path]
 * Example: /api/image/demo-shop/product-id/filename.webp
 */
export const imageRoutes = new Elysia({
  prefix: "/image",
}).get("/*", async ({ request, set }) => {
  try {
    // Extract path from URL: /api/image/shopSlug/productId/filename.webp
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Remove /api/image prefix to get the relative path
    const imagePath = pathname.replace(/^\/api\/image\//, "");

    if (!imagePath || imagePath.trim() === "") {
      set.status = 400;
      return { error: "Invalid image path" };
    }

    // Build file path: uploads/shopSlug/productId/filename.webp
    const uploadsDir = getUploadsDir();
    const filePath = join(uploadsDir, imagePath);

    // Security: Ensure the resolved path is within uploads directory
    const resolvedPath = resolve(filePath);
    const resolvedUploadsDir = resolve(uploadsDir);

    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      set.status = 403;
      return { error: "Forbidden: Invalid path" };
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      set.status = 404;
      return { error: "Image not found" };
    }

    // Read file
    const fileBuffer = await fs.readFile(resolvedPath);

    // Determine content type from file extension
    const ext = resolvedPath.split(".").pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      webp: "image/webp",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      svg: "image/svg+xml",
    };
    const contentType = contentTypeMap[ext || ""] || "application/octet-stream";

    // Return file with proper headers
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[Image Route] Error serving image:", error);
    set.status = 500;
    return { error: "Failed to serve image" };
  }
});
