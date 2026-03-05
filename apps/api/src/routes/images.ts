import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { Elysia } from "elysia";
import { resolveUploadsDirs } from "../storage/uploads-dir";

function buildPathVariants(pathSegments: string[]): string[][] {
  const variants: string[][] = [pathSegments];
  const fileName = pathSegments.at(-1);
  if (!fileName) {
    return variants;
  }

  const normalizedFileName = fileName.replace(
    /(\.(?:webp|png|jpe?g|gif|svg))(?:-\d+)+$/i,
    "$1",
  );
  if (normalizedFileName !== fileName) {
    variants.push([...pathSegments.slice(0, -1), normalizedFileName]);
  }

  return variants;
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

    const normalizedPath = imagePath.replace(/^\/+/, "");
    const pathSegments = normalizedPath.split("/").filter(Boolean);
    if (pathSegments.length === 0 || pathSegments.some((segment) => segment === "." || segment === "..")) {
      set.status = 400;
      return { error: "Invalid image path" };
    }

    const uploadsDirs = resolveUploadsDirs();
    const pathVariants = buildPathVariants(pathSegments);
    let resolvedPath: string | null = null;

    for (const segments of pathVariants) {
      for (const uploadsDir of uploadsDirs) {
        const candidatePath = resolve(join(uploadsDir, ...segments));
        const resolvedUploadsDir = resolve(uploadsDir);

        if (!candidatePath.startsWith(resolvedUploadsDir)) {
          continue;
        }

        try {
          await fs.access(candidatePath);
          resolvedPath = candidatePath;
          break;
        } catch {
          // Try the next fallback upload directory.
        }
      }

      if (resolvedPath) {
        break;
      }
    }

    if (!resolvedPath) {
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
