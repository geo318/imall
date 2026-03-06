import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { assets, db } from "@repo/db";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { getStorage } from "../storage";
import { resolveUploadsDirs } from "../storage/uploads-dir";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function findByFilenameFallback(
  uploadsDirs: string[],
  shopSlug: string,
  fileNames: string[],
): Promise<string | null> {
  for (const uploadsDir of uploadsDirs) {
    const resolvedUploadsDir = resolve(uploadsDir);
    const shopDir = resolve(join(uploadsDir, shopSlug));
    if (!shopDir.startsWith(resolvedUploadsDir)) {
      continue;
    }

    // 1) try /uploads/{shopSlug}/{filename}
    for (const fileName of fileNames) {
      const shopFilePath = resolve(join(shopDir, fileName));
      if (!shopFilePath.startsWith(shopDir)) {
        continue;
      }
      try {
        await fs.access(shopFilePath);
        return shopFilePath;
      } catch {
        // keep searching
      }
    }

    // 2) try one nested level: /uploads/{shopSlug}/{anyDir}/{filename}
    let entries: string[];
    try {
      entries = await fs.readdir(shopDir);
    } catch {
      continue;
    }

    for (const entryName of entries) {
      const entryPath = resolve(join(shopDir, entryName));
      if (!entryPath.startsWith(shopDir)) {
        continue;
      }

      let isDirectory = false;
      try {
        const stats = await fs.stat(entryPath);
        isDirectory = stats.isDirectory();
      } catch {
        isDirectory = false;
      }

      if (!isDirectory) {
        continue;
      }

      for (const fileName of fileNames) {
        const candidatePath = resolve(join(shopDir, entryName, fileName));
        if (!candidatePath.startsWith(shopDir)) {
          continue;
        }
        try {
          await fs.access(candidatePath);
          return candidatePath;
        } catch {
          // try next candidate
        }
      }
    }
  }

  return null;
}

async function resolveRemoteFallbackUrl(pathSegments: string[]): Promise<string | null> {
  if (pathSegments.length === 0) {
    return null;
  }

  const storage = getStorage();
  const requestedStorageKey = pathSegments.join("/");

  const [assetByStorageKey] = await db
    .select({
      storageKey: assets.storageKey,
    })
    .from(assets)
    .where(eq(assets.storageKey, requestedStorageKey))
    .limit(1);

  if (assetByStorageKey) {
    const url = storage.getUrl(assetByStorageKey.storageKey);
    return url.startsWith("http://") || url.startsWith("https://") ? url : null;
  }

  const candidateId = pathSegments.find((segment) => UUID_V4_RE.test(segment));
  if (!candidateId) {
    return null;
  }

  const [assetById] = await db
    .select({
      storageKey: assets.storageKey,
    })
    .from(assets)
    .where(eq(assets.id, candidateId))
    .limit(1);

  if (!assetById) {
    return null;
  }

  const url = storage.getUrl(assetById.storageKey);
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
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
      const shopSlug = pathSegments[0];
      if (shopSlug) {
        const filenameCandidates = Array.from(
          new Set(
            pathVariants
              .map((segments) => segments.at(-1))
              .filter((fileName): fileName is string => Boolean(fileName)),
          ),
        );

        resolvedPath = await findByFilenameFallback(uploadsDirs, shopSlug, filenameCandidates);
      }
    }

    if (!resolvedPath) {
      const fallbackUrl = await resolveRemoteFallbackUrl(pathSegments);
      if (fallbackUrl) {
        return Response.redirect(fallbackUrl, 307);
      }
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
