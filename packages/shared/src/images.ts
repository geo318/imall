const CORRUPTED_IMAGE_INDEX_SUFFIX_RE = /(\.(?:webp|png|jpe?g|gif|svg))(?:-\d+)+(?=$|[?#])/i;
const URL_START_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/|\/|blob:|data:|cloudinary:)/i;
const CLOUDINARY_TRANSFORMATION_TAIL_RE = /^[a-z][a-z0-9]*_[^/]+\/.+/i;

export function normalizeImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(CORRUPTED_IMAGE_INDEX_SUFFIX_RE, "$1");
}

export function parseImageUrls(imageUrls: string | null | undefined): string[] {
  if (!imageUrls) {
    return [];
  }

  const raw = imageUrls.trim();
  if (!raw) {
    return [];
  }

  // Forward-compatible: if stored as JSON array, parse directly.
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((value) => normalizeImageUrl(String(value ?? "")))
          .filter((url) => url.length > 0);
      }
    } catch {
      // Fall back to delimiter parsing below.
    }
  }

  const parts = raw.includes("\n") ? raw.split(/\r?\n/) : raw.split(",");
  const rebuilt: string[] = [];

  for (const part of parts) {
    const candidate = part.trim();
    if (!candidate) {
      continue;
    }

    const previous = rebuilt.at(-1);
    const shouldMergeCloudinaryTail =
      Boolean(previous) &&
      previous?.includes("res.cloudinary.com/") &&
      !URL_START_RE.test(candidate) &&
      CLOUDINARY_TRANSFORMATION_TAIL_RE.test(candidate);

    if (shouldMergeCloudinaryTail) {
      rebuilt[rebuilt.length - 1] = `${previous},${candidate}`;
      continue;
    }

    rebuilt.push(candidate);
  }

  return rebuilt.map((url) => normalizeImageUrl(url)).filter((url) => url.length > 0);
}

export function normalizeImagePathSegment(segment: string): string {
  return segment.replace(/(\.(?:webp|png|jpe?g|gif|svg))(?:-\d+)+$/i, "$1");
}
