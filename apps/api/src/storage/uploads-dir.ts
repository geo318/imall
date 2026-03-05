import { resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Resolve the uploads directory for local file storage.
 *
 * Prefer Render's persistent disk mount path when available.
 * Fall back to apps/api/src/uploads for local development.
 */
export function resolveUploadsDir(): string {
  const renderDiskPath = "/var/data";
  if (existsSync(renderDiskPath)) {
    return resolve(renderDiskPath, "uploads");
  }

  const currentDir = process.cwd();
  let apiSrcDir: string;

  if (currentDir.includes("apps/api")) {
    apiSrcDir = resolve(currentDir, "src");
  } else if (currentDir.includes("apps/web")) {
    apiSrcDir = resolve(currentDir, "..", "api", "src");
  } else {
    apiSrcDir = resolve(currentDir, "apps", "api", "src");
  }

  return resolve(apiSrcDir, "uploads");
}
