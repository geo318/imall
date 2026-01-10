import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Golang-like error handling helper
 * Returns [data, error] tuple where error is null on success
 */
export async function tryCatch<T>(promise: Promise<T>): Promise<[T, null] | [null, Error]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    if (error instanceof Error) {
      return [null, error];
    }
    return [null, new Error(String(error))];
  }
}

/**
 * Synchronous version of tryCatch for non-async operations
 */
export function tryCatchSync<T>(fn: () => T): [T, null] | [null, Error] {
  try {
    const data = fn();
    return [data, null];
  } catch (error) {
    if (error instanceof Error) {
      return [null, error];
    }
    return [null, new Error(String(error))];
  }
}

/**
 * Reserved route names that should not be treated as shop slugs
 */
export const RESERVED_ROUTES = [
  "cart",
  "checkout",
  "admin",
  "api",
  "products",
  "vendors",
  "about",
  "faq",
] as const;

/**
 * Check if a slug is a reserved route name
 */
export function isReservedRoute(slug: string): boolean {
  return RESERVED_ROUTES.includes(slug.toLowerCase() as (typeof RESERVED_ROUTES)[number]);
}

/**
 * Helper to check if a slug is a product identifier (contains 8-char short ID at the end)
 * Format: slug-abc12345 where abc12345 is an 8-character hex string
 */
export function isProductIdentifier(slug: string): boolean {
  const parts = slug.split("-");
  if (parts.length < 2) return false;
  const lastPart = parts.at(-1);
  return lastPart?.length === 8 && /^[a-f0-9]{8}$/i.test(lastPart);
}
