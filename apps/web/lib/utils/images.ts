/**
 * Image URL utilities for handling product images
 * Images are served from the API server via /api/image route
 * (e.g., http://localhost:3001/api/image/shopSlug/productId/filename.webp)
 */

/**
 * Get the API base URL from environment variables
 */
function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    // Server-side: use BACKEND_URL or DOMAIN
    return process.env.BACKEND_URL || process.env.DOMAIN || "http://localhost:3001";
  }
  // Client-side: use NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_DOMAIN
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3001"
  );
}

/**
 * Get a complete image URL by prepending the API base URL if needed
 * @param url - The image URL (can be relative like /api/image/... or full URL)
 * @returns A complete image URL pointing to the API server
 */
export function getImage(url: string | null | undefined): string {
  if (!url || url.trim() === "") {
    return "";
  }

  // If it's already a full URL (http:// or https://), return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // If it's already a path starting with /api/image/, prepend API base URL
  if (url.startsWith("/api/image/")) {
    const apiBaseUrl = getApiBaseUrl();
    const baseUrl = apiBaseUrl.replace(/\/$/, "");
    return `${baseUrl}${url}`;
  }

  // Legacy support: if it starts with /uploads/, convert to /api/image format
  if (url.startsWith("/uploads/")) {
    const apiBaseUrl = getApiBaseUrl();
    const baseUrl = apiBaseUrl.replace(/\/$/, "");
    // Convert /uploads/shopSlug/... to /api/image/shopSlug/...
    const pathWithoutUploads = url.replace(/^\/uploads\//, "");
    return `${baseUrl}/api/image/${pathWithoutUploads}`;
  }

  // If it's any other relative path starting with /, prepend API base URL
  if (url.startsWith("/")) {
    const apiBaseUrl = getApiBaseUrl();
    const baseUrl = apiBaseUrl.replace(/\/$/, "");
    return `${baseUrl}${url}`;
  }

  // Otherwise, treat as relative path and prepend API base URL
  const apiBaseUrl = getApiBaseUrl();
  const baseUrl = apiBaseUrl.replace(/\/$/, "");
  return `${baseUrl}/api/image/${url}`;
}

/**
 * Check if an image URL is valid (not null, undefined, or empty)
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.trim() !== "");
}

/**
 * Get the primary image from an array of images
 * @returns The image URL (will be processed by getImage when used)
 */
export function getPrimaryImage(
  images?: Array<{ url?: string | null; isPrimary?: boolean }> | null,
): string | null {
  if (!images || images.length === 0) {
    return null;
  }

  // Find primary image first
  const primary = images.find((img) => img.isPrimary && isValidImageUrl(img.url));
  if (primary?.url) {
    return primary.url;
  }

  // Fallback to first valid image
  const first = images.find((img) => isValidImageUrl(img.url));
  return first?.url || null;
}
