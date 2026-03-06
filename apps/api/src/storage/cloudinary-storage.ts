import { createHash } from "node:crypto";
import { env } from "@repo/shared";
import type { IStorage } from "./storage.interface";

const CLOUDINARY_PREFIX = "cloudinary:";

type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  source: "cloudinary_url" | "segment_env";
};

type CloudinaryUploadResponse = {
  public_id?: string;
  secure_url?: string;
  error?: {
    message?: string;
  };
};

type CloudinaryDestroyResponse = {
  result?: "ok" | "not found" | string;
  error?: {
    message?: string;
  };
};

function sanitizePathSegment(input: string): string {
  const sanitized = input
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return sanitized.length > 0 ? sanitized : "item";
}

function encodePublicId(publicId: string): string {
  return publicId
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function hasCloudinaryConfig() {
  return Boolean(resolveCloudinaryCredentials({ tolerant: true }));
}

function normalizeCloudNameFromHost(hostname: string): string {
  return hostname.replace(/\.cloudinary\.com$/i, "");
}

function parseCloudinaryUrl(rawValue: string): CloudinaryCredentials {
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error("Invalid CLOUDINARY_URL: expected URL format cloudinary://<api_key>:<api_secret>@<cloud_name>");
  }

  if (parsed.protocol !== "cloudinary:") {
    throw new Error("Invalid CLOUDINARY_URL: protocol must be cloudinary://");
  }

  const cloudName = normalizeCloudNameFromHost(parsed.hostname.trim());
  const apiKey = decodeURIComponent(parsed.username.trim());
  const apiSecret = decodeURIComponent(parsed.password.trim());

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Invalid CLOUDINARY_URL: cloud name, api key, and api secret are all required",
    );
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    source: "cloudinary_url",
  };
}

export function resolveCloudinaryCredentials(options?: {
  tolerant?: boolean;
}): CloudinaryCredentials | null {
  const rawCloudinaryUrl = env.CLOUDINARY_URL?.trim();
  if (rawCloudinaryUrl) {
    try {
      return parseCloudinaryUrl(rawCloudinaryUrl);
    } catch (error) {
      if (options?.tolerant) {
        return null;
      }
      throw error;
    }
  }

  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    return {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
      source: "segment_env",
    };
  }

  return null;
}

export class CloudinaryStorage implements IStorage {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseFolder: string;
  private readonly deliveryTransformation: string;
  private readonly credentialsSource: CloudinaryCredentials["source"];

  static isConfigured(): boolean {
    return hasCloudinaryConfig();
  }

  constructor() {
    if (!CloudinaryStorage.isConfigured()) {
      throw new Error(
        "Cloudinary storage is not configured. Provide CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET",
      );
    }

    const credentials = resolveCloudinaryCredentials();
    if (!credentials) {
      throw new Error(
        "Cloudinary storage is not configured. Provide CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET",
      );
    }

    this.cloudName = credentials.cloudName;
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    this.credentialsSource = credentials.source;
    this.baseFolder = sanitizePathSegment(env.CLOUDINARY_BASE_FOLDER || "imall");
    const rawTransformation = (env.CLOUDINARY_DELIVERY_TRANSFORMATION || "f_auto,q_auto").trim();
    const normalizedTransformation = rawTransformation
      .replace(/^\/+|\/+$/g, "")
      .split(/[\/,]/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .join("/");
    this.deliveryTransformation = normalizedTransformation || "f_auto/q_auto";
  }

  getDiagnostics() {
    return {
      cloudName: this.cloudName,
      source: this.credentialsSource,
      baseFolder: this.baseFolder,
      deliveryTransformation: this.deliveryTransformation,
    };
  }

  private getUploadEndpoint() {
    return `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
  }

  private getDestroyEndpoint() {
    return `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`;
  }

  private getDeliveryUrl(publicId: string) {
    const encodedPublicId = encodePublicId(publicId);
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${this.deliveryTransformation}/${encodedPublicId}`;
  }

  private sign(params: Record<string, string>) {
    const toSign = Object.entries(params)
      .filter(([, value]) => value !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    return createHash("sha1")
      .update(`${toSign}${this.apiSecret}`)
      .digest("hex");
  }

  private toStorageKey(publicId: string) {
    return `${CLOUDINARY_PREFIX}${publicId}`;
  }

  private extractPublicId(storageKey: string): string | null {
    if (!storageKey.startsWith(CLOUDINARY_PREFIX)) {
      return null;
    }

    const publicId = storageKey.slice(CLOUDINARY_PREFIX.length);
    return publicId.length > 0 ? publicId : null;
  }

  async upload(file: File, shopSlug: string, productId?: string): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const uploadKey = `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    const publicId = [this.baseFolder, sanitizePathSegment(shopSlug)]
      .concat(productId ? [sanitizePathSegment(productId)] : [])
      .concat(uploadKey)
      .join("/");

    const signature = this.sign({
      public_id: publicId,
      timestamp,
    });

    const formData = new FormData();
    formData.set("file", file);
    formData.set("api_key", this.apiKey);
    formData.set("timestamp", timestamp);
    formData.set("public_id", publicId);
    formData.set("signature", signature);

    const response = await fetch(this.getUploadEndpoint(), {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => ({}))) as CloudinaryUploadResponse;

    if (!response.ok || !payload.public_id) {
      const reason = payload.error?.message || `Cloudinary upload failed with status ${response.status}`;
      throw new Error(reason);
    }

    return this.toStorageKey(payload.public_id);
  }

  getUrl(storageKey: string): string {
    if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
      return storageKey;
    }

    if (storageKey.startsWith("/api/image/")) {
      return storageKey;
    }

    const publicId = this.extractPublicId(storageKey);
    if (!publicId) {
      const normalizedLegacyKey = storageKey.replace(/^\/+/, "").replace(/^api\/image\//, "");
      return `/api/image/${normalizedLegacyKey}`;
    }

    return this.getDeliveryUrl(publicId);
  }

  async delete(storageKey: string): Promise<void> {
    const publicId = this.extractPublicId(storageKey);
    if (!publicId) {
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign({
      public_id: publicId,
      timestamp,
    });

    const formData = new FormData();
    formData.set("public_id", publicId);
    formData.set("timestamp", timestamp);
    formData.set("api_key", this.apiKey);
    formData.set("signature", signature);

    const response = await fetch(this.getDestroyEndpoint(), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as CloudinaryDestroyResponse;
    if (payload.error?.message) {
      console.warn("[CloudinaryStorage] Delete warning:", payload.error.message);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const publicId = this.extractPublicId(storageKey);
    if (!publicId) {
      return false;
    }

    try {
      const response = await fetch(this.getDeliveryUrl(publicId), {
        method: "HEAD",
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
