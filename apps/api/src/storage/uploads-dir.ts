import { resolve } from "node:path";
import { existsSync } from "node:fs";

const RENDER_DISK_ROOT = "/var/data";

function resolveLocalUploadsDirFromCwd(): string {
  const currentDir = process.cwd();
  const uploadsRelativePath = ["uploads"];

  if (currentDir.includes("apps/api")) {
    return resolve(currentDir, "src", ...uploadsRelativePath);
  }

  if (currentDir.includes("apps/web")) {
    return resolve(currentDir, "..", "api", "src", ...uploadsRelativePath);
  }

  return resolve(currentDir, "apps", "api", "src", ...uploadsRelativePath);
}

function resolveRenderUploadsDir(): string {
  return resolve(RENDER_DISK_ROOT, "uploads");
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((item) => resolve(item)))];
}

/**
 * Resolve the uploads directory for local file storage.
 *
 * Prefer Render's persistent disk mount path when available.
 * Fall back to apps/api/src/uploads for local development.
 */
export function resolveUploadsDir(): string {
  const [primaryDir] = resolveUploadsDirs();
  return primaryDir ?? resolveLocalUploadsDirFromCwd();
}

/**
 * Resolve upload directories in priority order.
 *
 * The first path is used for writes; subsequent paths are legacy fallbacks
 * that can still be used for reads while migrating environments.
 */
export function resolveUploadsDirs(): string[] {
  const localUploads = resolveLocalUploadsDirFromCwd();
  const renderUploads = resolveRenderUploadsDir();
  const hasRenderDiskRoot = existsSync(RENDER_DISK_ROOT);

  if (hasRenderDiskRoot) {
    return uniquePaths([renderUploads, localUploads]);
  }

  return uniquePaths([localUploads, renderUploads]);
}

export function summarizeUploadsDirs() {
  return resolveUploadsDirs().map((dirPath) => ({
    path: dirPath,
    exists: existsSync(dirPath),
  }));
}
