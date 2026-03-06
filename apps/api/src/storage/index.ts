import { env } from "@repo/shared";
import { CloudinaryStorage, resolveCloudinaryCredentials } from "./cloudinary-storage";
import { LocalStorage } from "./local-storage";
import type { IStorage } from "./storage.interface";

/**
 * Storage factory - returns the configured storage implementation
 * Can be swapped for S3, Cloudinary, etc. in the future
 */
let cachedStorage: IStorage | null = null;

function hasCloudinaryConfig() {
  return Boolean(resolveCloudinaryCredentials({ tolerant: true }));
}

export function resolveStorageProvider(): "local" | "cloudinary" {
  const explicitProvider = env.IMAGE_STORAGE_PROVIDER;
  if (explicitProvider) {
    return explicitProvider;
  }
  return hasCloudinaryConfig() ? "cloudinary" : "local";
}

export function getStorage(): IStorage {
  if (cachedStorage) {
    return cachedStorage;
  }

  const provider = resolveStorageProvider();

  if (provider === "cloudinary") {
    if (!CloudinaryStorage.isConfigured()) {
      throw new Error(
        "IMAGE_STORAGE_PROVIDER=cloudinary but Cloudinary credentials are missing/invalid. Provide CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.",
      );
    }
    cachedStorage = new CloudinaryStorage();
    return cachedStorage;
  }

  if (env.NODE_ENV === "production") {
    console.warn(
      "[Storage] Using local storage in production. Set IMAGE_STORAGE_PROVIDER=cloudinary to avoid instance/disk persistence issues.",
    );
  }

  cachedStorage = new LocalStorage();
  return cachedStorage;
}

export type { IStorage } from "./storage.interface";
