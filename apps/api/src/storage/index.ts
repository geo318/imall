import { LocalStorage } from "./local-storage";
import type { IStorage } from "./storage.interface";

/**
 * Storage factory - returns the configured storage implementation
 * Can be swapped for S3, Cloudinary, etc. in the future
 */
export function getStorage(): IStorage {
  // For now, use local filesystem storage
  // In production, this could check env vars and return S3Storage, etc.
  return new LocalStorage();
}

export type { IStorage } from "./storage.interface";
