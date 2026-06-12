import type { Dirent } from "node:fs";
import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import { assets, db } from "@repo/db";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { getStorage } from "../storage";
import { resolveUploadsDirs } from "../storage/uploads-dir";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_TYPE_MAP: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  svg: "image/svg+xml",
};

// --- Resolved-path cache ---
// Avoids repeated filesystem probing for the same image URL.
type ResolvedCacheInput =
  | { type: "file"; path: string }
  | { type: "redirect"; url: string }
  | { type: "miss" };

type ResolvedCacheEntry = ResolvedCacheInput & { expiresAt: number };

const RESOLVED_CACHE_HIT_TTL = 5 * 60 * 1000;
const RESOLVED_CACHE_MISS_TTL = 30_000;
const RESOLVED_CACHE_MAX = 2_000;
const RESOLVED_CACHE_TARGET = Math.floor(RESOLVED_CACHE_MAX * 0.75);
const resolvedCache = new Map<string, ResolvedCacheEntry>();

function getCachedResolved(key: string): ResolvedCacheInput | null {
  const entry = resolvedCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    resolvedCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedResolved(key: string, result: ResolvedCacheInput) {
  if (resolvedCache.size >= RESOLVED_CACHE_MAX) {
    const now = Date.now();
    const maxCandidates = resolvedCache.size - RESOLVED_CACHE_TARGET;
    const trimCandidates: string[] = [];
    for (const [k, e] of resolvedCache) {
      if (e.expiresAt <= now) {
        resolvedCache.delete(k);
      } else if (trimCandidates.length < maxCandidates) {
        trimCandidates.push(k);
      }
    }
    const excess = resolvedCache.size - RESOLVED_CACHE_TARGET;
    for (const k of trimCandidates.slice(0, excess)) {
      resolvedCache.delete(k);
    }
  }
  const ttl = result.type === "miss" ? RESOLVED_CACHE_MISS_TTL : RESOLVED_CACHE_HIT_TTL;
  resolvedCache.set(key, { ...result, expiresAt: Date.now() + ttl });
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of resolvedCache.entries()) {
    if (entry.expiresAt <= now) resolvedCache.delete(key);
  }
}, 15_000).unref();

// --- Helpers ---

function buildPathVariants(pathSegments: string[]): string[][] {
  const variants: string[][] = [pathSegments];
  const fileName = pathSegments.at(-1);
  if (!fileName) return variants;
  const normalizedFileName = fileName.replace(/(\.(?:webp|png|jpe?g|gif|svg))(?:-\d+)+$/i, "$1");
  if (normalizedFileName !== fileName) {
    variants.push([...pathSegments.slice(0, -1), normalizedFileName]);
  }
  return variants;
}

// Checks all candidate paths in parallel; returns the first accessible one.
async function findFirstAccessible(candidates: string[]): Promise<string | null> {
  if (candidates.length === 0) return null;
  const results = await Promise.allSettled(candidates.map((p) => fs.access(p).then(() => p)));
  for (const result of results) {
    if (result.status === "fulfilled") return result.value;
  }
  return null;
}

async function findByFilenameFallback(
  uploadsDirs: string[],
  shopSlug: string,
  fileNames: string[],
): Promise<string | null> {
  for (const uploadsDir of uploadsDirs) {
    const resolvedUploadsDir = resolve(uploadsDir);
    const shopDir = resolve(join(uploadsDir, shopSlug));
    if (!shopDir.startsWith(resolvedUploadsDir)) continue;

    // 1) /uploads/{shopSlug}/{filename} — all filenames checked in parallel
    const directCandidates = fileNames
      .map((fn) => resolve(join(shopDir, fn)))
      .filter((p) => p.startsWith(shopDir));
    const direct = await findFirstAccessible(directCandidates);
    if (direct) return direct;

    // 2) one nested level — readdir with withFileTypes avoids N stat() calls
    let entries: Dirent[];
    try {
      entries = await fs.readdir(shopDir, { withFileTypes: true });
    } catch {
      continue;
    }

    const nestedCandidates = entries
      .filter((e) => e.isDirectory())
      .flatMap((entry) =>
        fileNames
          .map((fn) => resolve(join(shopDir, entry.name, fn)))
          .filter((p) => p.startsWith(shopDir)),
      );
    const nested = await findFirstAccessible(nestedCandidates);
    if (nested) return nested;
  }

  return null;
}

async function resolveRemoteFallbackUrl(pathSegments: string[]): Promise<string | null> {
  if (pathSegments.length === 0) return null;

  const storage = getStorage();
  const requestedStorageKey = pathSegments.join("/");
  const candidateId = pathSegments.find((s) => UUID_V4_RE.test(s));

  // Both DB lookups run in parallel
  const [byKey, byId] = await Promise.all([
    db
      .select({ storageKey: assets.storageKey })
      .from(assets)
      .where(eq(assets.storageKey, requestedStorageKey))
      .limit(1),
    candidateId
      ? db
          .select({ storageKey: assets.storageKey })
          .from(assets)
          .where(eq(assets.id, candidateId))
          .limit(1)
      : Promise.resolve([] as { storageKey: string }[]),
  ]);

  const asset = byKey[0] ?? byId[0];
  if (!asset) return null;

  const url = storage.getUrl(asset.storageKey);
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
}

function serveFile(resolvedPath: string): Response {
  const ext = resolvedPath.split(".").pop()?.toLowerCase();
  const contentType = CONTENT_TYPE_MAP[ext ?? ""] ?? "application/octet-stream";
  return new Response(Bun.file(resolvedPath), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

/**
 * Image serving route
 * Route: /api/image/:shopSlug/[...path]
 * Example: /api/image/demo-shop/product-id/filename.webp
 */
export const imageRoutes = new Elysia({ prefix: "/image" }).get("/*", async ({ request, set }) => {
  try {
    const url = new URL(request.url);
    const imagePath = url.pathname.replace(/^\/api\/image\//, "");

    if (!imagePath || imagePath.trim() === "") {
      set.status = 400;
      return { error: "Invalid image path" };
    }

    const normalizedPath = imagePath.replace(/^\/+/, "");
    const pathSegments = normalizedPath.split("/").filter(Boolean);
    if (pathSegments.length === 0 || pathSegments.some((s) => s === "." || s === "..")) {
      set.status = 400;
      return { error: "Invalid image path" };
    }

    // Fast path: serve from cache without any FS or DB work
    const cached = getCachedResolved(normalizedPath);
    if (cached) {
      if (cached.type === "miss") {
        set.status = 404;
        return { error: "Image not found" };
      }
      if (cached.type === "redirect") return Response.redirect(cached.url, 307);
      return serveFile(cached.path);
    }

    const uploadsDirs = resolveUploadsDirs();
    const pathVariants = buildPathVariants(pathSegments);

    // Check all path variants × upload dirs in parallel
    const allCandidates = pathVariants.flatMap((segments) =>
      uploadsDirs
        .map((uploadsDir) => {
          const candidate = resolve(join(uploadsDir, ...segments));
          return candidate.startsWith(resolve(uploadsDir)) ? candidate : null;
        })
        .filter((p): p is string => p !== null),
    );

    let resolvedPath = await findFirstAccessible(allCandidates);

    if (!resolvedPath) {
      const shopSlug = pathSegments[0];
      if (shopSlug) {
        const filenameCandidates = Array.from(
          new Set(
            pathVariants.map((segs) => segs.at(-1)).filter((fn): fn is string => Boolean(fn)),
          ),
        );
        resolvedPath = await findByFilenameFallback(uploadsDirs, shopSlug, filenameCandidates);
      }
    }

    if (!resolvedPath) {
      const fallbackUrl = await resolveRemoteFallbackUrl(pathSegments);
      if (fallbackUrl) {
        setCachedResolved(normalizedPath, { type: "redirect", url: fallbackUrl });
        return Response.redirect(fallbackUrl, 307);
      }
      setCachedResolved(normalizedPath, { type: "miss" });
      set.status = 404;
      return { error: "Image not found" };
    }

    setCachedResolved(normalizedPath, { type: "file", path: resolvedPath });
    return serveFile(resolvedPath);
  } catch (error) {
    console.error("[Image Route] Error serving image:", error);
    set.status = 500;
    return { error: "Failed to serve image" };
  }
});
