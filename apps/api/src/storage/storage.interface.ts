/**
 * Pluggable storage interface for file uploads
 * Implementations: LocalStorage, S3Storage, etc.
 */
export interface IStorage {
  /**
   * Upload a file and return the storage key
   * @param file - File to upload
   * @param shopSlug - Shop slug for folder organization
   * @param productId - Product ID for folder organization (optional, for product images)
   */
  upload(file: File, shopSlug: string, productId?: string): Promise<string>;

  /**
   * Get the public URL for a storage key
   */
  getUrl(storageKey: string): string;

  /**
   * Delete a file by storage key
   */
  delete(storageKey: string): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(storageKey: string): Promise<boolean>;
}
