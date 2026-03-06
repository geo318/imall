import { normalizeImageUrl } from "@repo/shared";
import { resolveStorageProvider } from "../storage";

const storageProvider = resolveStorageProvider();

function isApiImagePath(value: string): boolean {
  const normalized = normalizeImageUrl(value).trim();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("/api/image/")) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.pathname.startsWith("/api/image/");
  } catch {
    return false;
  }
}

function dedupeNormalizedUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const rawUrl of urls) {
    const normalized = normalizeImageUrl(rawUrl).trim();
    if (!normalized) {
      continue;
    }

    const dedupeKey = (() => {
      try {
        const parsed = new URL(normalized);
        return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
      } catch {
        return normalized.replace(/[?#].*$/, "").replace(/\/+$/, "");
      }
    })();

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    next.push(normalized);
  }

  return next;
}

/**
 * Normalizes/dedupes persisted product image URLs and, when Cloudinary storage
 * is active, prefers durable URLs over legacy `/api/image/*` local-disk URLs.
 *
 * This prevents old local paths from staying primary after migration.
 */
export function sanitizePersistedImageUrls(urls: string[]): string[] {
  const deduped = dedupeNormalizedUrls(urls);

  if (storageProvider !== "cloudinary") {
    return deduped;
  }

  const durableUrls = deduped.filter((url) => !isApiImagePath(url));
  return durableUrls.length > 0 ? durableUrls : deduped;
}

