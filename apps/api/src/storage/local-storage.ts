import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { resolveUploadsDir } from "./uploads-dir";
import type { IStorage } from "./storage.interface";

/**
 * Local filesystem storage implementation
 */
export class LocalStorage implements IStorage {
  private baseDir: string;

  constructor() {
    // Store files on persistent disk when available (Render /var/data),
    // otherwise default to apps/api/src/uploads for local development.
    this.baseDir = resolveUploadsDir();
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error("[LocalStorage] Failed to create uploads directory:", error);
    }
  }

  async upload(file: File, shopSlug: string, productId?: string): Promise<string> {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    // Always use webp for optimized images
    const filename = `${timestamp}-${randomStr}.webp`;

    // Build folder structure: shopSlug/productId/filename
    let filePath: string;
    let storageKey: string;

    if (productId) {
      // Product images: shopSlug/productId/filename
      filePath = join(this.baseDir, shopSlug, productId, filename);
      storageKey = `${shopSlug}/${productId}/${filename}`;
    } else {
      // Other files: shopSlug/filename
      filePath = join(this.baseDir, shopSlug, filename);
      storageKey = `${shopSlug}/${filename}`;
    }

    // Ensure directory exists before writing
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Optimize image: resize to max 600x600, convert to webp, 85% quality
    let optimizedBuffer: Buffer;
    try {
      optimizedBuffer = await sharp(buffer)
        .resize(600, 600, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (error) {
      // If sharp fails (e.g., not an image), use original buffer
      console.warn("[LocalStorage] Image optimization failed, using original:", error);
      optimizedBuffer = buffer;
    }

    await fs.writeFile(filePath, optimizedBuffer);

    return storageKey;
  }

  getUrl(storageKey: string): string {
    // Return URL that will be served via /api/image route
    // Format: /api/image/shopSlug/productId/filename or /api/image/shopSlug/filename
    return `/api/image/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = join(this.baseDir, storageKey);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, that's okay
      console.warn("[LocalStorage] Failed to delete file:", storageKey, error);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const filePath = join(this.baseDir, storageKey);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
