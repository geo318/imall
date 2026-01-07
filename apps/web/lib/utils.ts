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
