const CORRUPTED_IMAGE_INDEX_SUFFIX_RE = /(\.(?:webp|png|jpe?g|gif|svg))(?:-\d+)+(?=$|[?#])/i;

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

  return imageUrls
    .split(",")
    .map((url) => normalizeImageUrl(url))
    .filter((url) => url.length > 0);
}
