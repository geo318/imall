import { db } from "@repo/db";
import { assets, productImages, products, variantOptionValues } from "@repo/db/schema";
import { normalizeImageUrl, parseImageUrls } from "@repo/shared";
import { and, eq, isNotNull, like } from "drizzle-orm";
import {
  CloudinaryStorage,
  resolveCloudinaryCredentials,
} from "../apps/api/src/storage/cloudinary-storage";

type ProductRow = {
  id: string;
  tenantId: string;
  imageUrls: string | null;
};

type ThumbnailRow = {
  id: string;
  tenantId: string;
  thumbnailUrl: string | null;
};

type AssetRow = {
  id: string;
  tenantId: string;
  storageKey: string;
  createdAt: Date;
};

type ParsedArgs = {
  apply: boolean;
  tenantId: string | null;
  minAgeHours: number;
};

type CleanupStats = {
  productsScanned: number;
  productRowsUpdated: number;
  productUrlsNormalized: number;
  productUrlsRemovedStale: number;
  thumbnailsScanned: number;
  thumbnailRowsUpdated: number;
  thumbnailsNormalized: number;
  thumbnailsRemovedStale: number;
  orphanAssetCandidates: number;
  orphanAssetsDeleted: number;
  orphanAssetsSkipped: number;
};

const CLOUDINARY_STORAGE_PREFIX = "cloudinary:";
const DEFAULT_MIN_AGE_HOURS = 24;
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseArgs(argv: string[]): ParsedArgs {
  const args = new Set(argv);
  const getValue = (name: string): string | null => {
    for (const arg of argv) {
      if (arg.startsWith(`${name}=`)) {
        return arg.slice(name.length + 1);
      }
    }
    return null;
  };

  const rawMinAgeHours = getValue("--min-age-hours");
  const minAgeHours = Number(rawMinAgeHours ?? DEFAULT_MIN_AGE_HOURS);
  if (!Number.isFinite(minAgeHours) || minAgeHours < 0) {
    throw new Error("--min-age-hours must be a non-negative number");
  }

  const tenantId = getValue("--tenant-id");

  return {
    apply: args.has("--apply"),
    tenantId: tenantId?.trim() || null,
    minAgeHours,
  };
}

function normalizeBaseFolder(input: string | undefined): string {
  const sanitized = (input || "imall")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return sanitized.length > 0 ? sanitized : "imall";
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeCompareKey(url: string): string {
  const normalized = normalizeImageUrl(url);
  try {
    const parsed = new URL(normalized);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return normalized.replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function tryExtractAssetIdFromImageUrl(value: string): string | null {
  const normalized = normalizeImageUrl(value).trim();
  if (!normalized) {
    return null;
  }

  let pathname: string;
  try {
    pathname = new URL(normalized, "https://imall.local").pathname;
  } catch {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean).map((segment) => safeDecode(segment));
  if (segments.length === 0) {
    return null;
  }

  for (const segment of segments) {
    if (UUID_V4_RE.test(segment)) {
      return segment;
    }
  }

  return null;
}

function tryExtractCloudinaryStorageKeyFromUrl(
  value: string,
  cloudName: string | null,
  baseFolder: string,
): string | null {
  if (!cloudName) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.hostname !== "res.cloudinary.com") {
    return null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    segments.length < 5 ||
    segments[0] !== cloudName ||
    segments[1] !== "image" ||
    segments[2] !== "upload"
  ) {
    return null;
  }

  const uploadTail = segments.slice(3).map((segment) => safeDecode(segment));
  const publicIdStart = uploadTail.findIndex((segment) => segment === baseFolder);
  if (publicIdStart < 0) {
    return null;
  }

  const publicId = uploadTail.slice(publicIdStart).join("/");
  if (!publicId) {
    return null;
  }

  return `${CLOUDINARY_STORAGE_PREFIX}${publicId}`;
}

async function loadProducts(tenantId: string | null): Promise<ProductRow[]> {
  if (tenantId) {
    return db
      .select({
        id: products.id,
        tenantId: products.tenantId,
        imageUrls: products.imageUrls,
      })
      .from(products)
      .where(eq(products.tenantId, tenantId));
  }

  return db
    .select({
      id: products.id,
      tenantId: products.tenantId,
      imageUrls: products.imageUrls,
    })
    .from(products);
}

async function loadThumbnails(tenantId: string | null): Promise<ThumbnailRow[]> {
  if (tenantId) {
    return db
      .select({
        id: variantOptionValues.id,
        tenantId: variantOptionValues.tenantId,
        thumbnailUrl: variantOptionValues.thumbnailUrl,
      })
      .from(variantOptionValues)
      .where(
        and(eq(variantOptionValues.tenantId, tenantId), isNotNull(variantOptionValues.thumbnailUrl)),
      );
  }

  return db
    .select({
      id: variantOptionValues.id,
      tenantId: variantOptionValues.tenantId,
      thumbnailUrl: variantOptionValues.thumbnailUrl,
    })
    .from(variantOptionValues)
    .where(isNotNull(variantOptionValues.thumbnailUrl));
}

async function loadCloudinaryAssets(tenantId: string | null): Promise<AssetRow[]> {
  if (tenantId) {
    return db
      .select({
        id: assets.id,
        tenantId: assets.tenantId,
        storageKey: assets.storageKey,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .where(and(eq(assets.tenantId, tenantId), like(assets.storageKey, `${CLOUDINARY_STORAGE_PREFIX}%`)));
  }

  return db
    .select({
      id: assets.id,
      tenantId: assets.tenantId,
      storageKey: assets.storageKey,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .where(like(assets.storageKey, `${CLOUDINARY_STORAGE_PREFIX}%`));
}

async function loadReferencedAssetIds(tenantId: string | null): Promise<Set<string>> {
  const rows = tenantId
    ? await db
        .select({ assetId: productImages.assetId })
        .from(productImages)
        .where(eq(productImages.tenantId, tenantId))
    : await db.select({ assetId: productImages.assetId }).from(productImages);

  return new Set(rows.map((row) => row.assetId));
}

async function main() {
  const parsedArgs = parseArgs(process.argv.slice(2));
  const { apply, tenantId, minAgeHours } = parsedArgs;
  const mode = apply ? "apply" : "dry-run";
  const cloudinaryCredentials = resolveCloudinaryCredentials({ tolerant: true });
  const cloudinaryStorage = cloudinaryCredentials ? new CloudinaryStorage() : null;
  const cloudName = cloudinaryCredentials?.cloudName ?? null;
  const baseFolder = normalizeBaseFolder(process.env.CLOUDINARY_BASE_FOLDER);
  const existsCache = new Map<string, boolean>();

  const stats: CleanupStats = {
    productsScanned: 0,
    productRowsUpdated: 0,
    productUrlsNormalized: 0,
    productUrlsRemovedStale: 0,
    thumbnailsScanned: 0,
    thumbnailRowsUpdated: 0,
    thumbnailsNormalized: 0,
    thumbnailsRemovedStale: 0,
    orphanAssetCandidates: 0,
    orphanAssetsDeleted: 0,
    orphanAssetsSkipped: 0,
  };

  console.log(
    `[cleanup-image-storage] starting (${mode})`,
    JSON.stringify({
      tenantId: tenantId ?? null,
      minAgeHours,
      cloudinaryConfigured: Boolean(cloudinaryCredentials),
      cloudName,
      baseFolder,
    }),
  );

  const [assetRows, productRows, thumbnailRows, referencedAssetIds] = await Promise.all([
    loadCloudinaryAssets(tenantId),
    loadProducts(tenantId),
    loadThumbnails(tenantId),
    loadReferencedAssetIds(tenantId),
  ]);

  const assetByStorageKey = new Map(assetRows.map((row) => [row.storageKey, row]));
  const assetById = new Map(assetRows.map((row) => [row.id, row]));
  const referencedStorageKeys = new Set<string>();
  const referencedAssetIdsFromUrls = new Set<string>();
  const productUpdates: Array<{ id: string; imageUrls: string | null }> = [];
  const thumbnailUpdates: Array<{ id: string; thumbnailUrl: string | null }> = [];

  const checkExists = async (storageKey: string): Promise<boolean> => {
    if (!cloudinaryStorage) {
      return true;
    }
    if (existsCache.has(storageKey)) {
      return existsCache.get(storageKey) ?? false;
    }
    const exists = await cloudinaryStorage.exists(storageKey);
    existsCache.set(storageKey, exists);
    return exists;
  };

  for (const product of productRows) {
    stats.productsScanned += 1;
    const originalRaw = product.imageUrls;
    const parsedUrls = parseImageUrls(originalRaw);
    if (parsedUrls.length === 0) {
      continue;
    }

    const nextUrls: string[] = [];
    const dedupe = new Set<string>();
    let changed = false;

    for (const rawUrl of parsedUrls) {
      const normalizedUrl = normalizeImageUrl(rawUrl);
      let nextUrl = normalizedUrl;
      const parsedStorageKey = tryExtractCloudinaryStorageKeyFromUrl(
        normalizedUrl,
        cloudName,
        baseFolder,
      );
      const parsedAssetId = tryExtractAssetIdFromImageUrl(normalizedUrl);

      if (parsedAssetId) {
        const referencedAsset = assetById.get(parsedAssetId);
        if (referencedAsset) {
          referencedAssetIdsFromUrls.add(referencedAsset.id);
          referencedStorageKeys.add(referencedAsset.storageKey);
        }
      }

      if (normalizedUrl !== rawUrl) {
        stats.productUrlsNormalized += 1;
        changed = true;
      }

      if (parsedStorageKey) {
        const knownAsset = assetByStorageKey.get(parsedStorageKey);
        if (knownAsset && cloudinaryStorage) {
          const canonicalUrl = cloudinaryStorage.getUrl(parsedStorageKey);
          if (normalizeCompareKey(canonicalUrl) !== normalizeCompareKey(normalizedUrl)) {
            nextUrl = canonicalUrl;
            stats.productUrlsNormalized += 1;
            changed = true;
          }
          referencedStorageKeys.add(parsedStorageKey);
        } else {
          const exists = await checkExists(parsedStorageKey);
          if (!exists) {
            stats.productUrlsRemovedStale += 1;
            changed = true;
            continue;
          }
          referencedStorageKeys.add(parsedStorageKey);
        }
      }

      const dedupeKey = normalizeCompareKey(nextUrl);
      if (dedupe.has(dedupeKey)) {
        changed = true;
        continue;
      }
      dedupe.add(dedupeKey);
      nextUrls.push(nextUrl);
    }

    const nextImageUrls = nextUrls.length > 0 ? nextUrls.join(",") : null;
    if (changed || nextImageUrls !== originalRaw) {
      productUpdates.push({ id: product.id, imageUrls: nextImageUrls });
    }
  }

  for (const row of thumbnailRows) {
    stats.thumbnailsScanned += 1;
    const originalRaw = row.thumbnailUrl;
    if (!originalRaw) {
      continue;
    }

    const normalized = normalizeImageUrl(originalRaw);
    let nextUrl: string | null = normalized;
    let changed = normalized !== originalRaw;
    if (changed) {
      stats.thumbnailsNormalized += 1;
    }

    const parsedStorageKey = tryExtractCloudinaryStorageKeyFromUrl(normalized, cloudName, baseFolder);
    const parsedAssetId = tryExtractAssetIdFromImageUrl(normalized);
    if (parsedAssetId) {
      const referencedAsset = assetById.get(parsedAssetId);
      if (referencedAsset) {
        referencedAssetIdsFromUrls.add(referencedAsset.id);
        referencedStorageKeys.add(referencedAsset.storageKey);
      }
    }
    if (parsedStorageKey) {
      const knownAsset = assetByStorageKey.get(parsedStorageKey);
      if (knownAsset && cloudinaryStorage) {
        const canonicalUrl = cloudinaryStorage.getUrl(parsedStorageKey);
        if (normalizeCompareKey(canonicalUrl) !== normalizeCompareKey(normalized)) {
          nextUrl = canonicalUrl;
          changed = true;
          stats.thumbnailsNormalized += 1;
        }
        referencedStorageKeys.add(parsedStorageKey);
      } else {
        const exists = await checkExists(parsedStorageKey);
        if (!exists) {
          nextUrl = null;
          changed = true;
          stats.thumbnailsRemovedStale += 1;
        } else {
          referencedStorageKeys.add(parsedStorageKey);
        }
      }
    }

    if (changed || nextUrl !== originalRaw) {
      thumbnailUpdates.push({ id: row.id, thumbnailUrl: nextUrl });
    }
  }

  if (apply) {
    for (const update of productUpdates) {
      await db.update(products).set({ imageUrls: update.imageUrls }).where(eq(products.id, update.id));
    }
    for (const update of thumbnailUpdates) {
      await db
        .update(variantOptionValues)
        .set({ thumbnailUrl: update.thumbnailUrl })
        .where(eq(variantOptionValues.id, update.id));
    }
  }

  stats.productRowsUpdated = productUpdates.length;
  stats.thumbnailRowsUpdated = thumbnailUpdates.length;

  const cutoffTs = Date.now() - minAgeHours * 60 * 60 * 1000;
  const orphanAssets = assetRows.filter((asset) => {
    if (referencedAssetIds.has(asset.id)) {
      return false;
    }
    if (referencedAssetIdsFromUrls.has(asset.id)) {
      return false;
    }
    if (referencedStorageKeys.has(asset.storageKey)) {
      return false;
    }
    return asset.createdAt.getTime() <= cutoffTs;
  });

  stats.orphanAssetCandidates = orphanAssets.length;

  if (!cloudinaryStorage) {
    stats.orphanAssetsSkipped = orphanAssets.length;
    if (orphanAssets.length > 0) {
      console.warn(
        "[cleanup-image-storage] Cloudinary credentials are missing. Skipping orphan blob deletion.",
      );
    }
  } else if (apply) {
    for (const orphan of orphanAssets) {
      await cloudinaryStorage.delete(orphan.storageKey);
      await db.delete(assets).where(eq(assets.id, orphan.id));
      stats.orphanAssetsDeleted += 1;
    }
  }

  console.log(
    `[cleanup-image-storage] ${mode} summary`,
    JSON.stringify(stats, null, 2),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[cleanup-image-storage] failed", error);
    process.exit(1);
  });
