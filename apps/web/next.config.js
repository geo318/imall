import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const nodeEnv = process.env.NODE_ENV ?? "development";

function loadRootEnv() {
  try {
    // Prefer Next's loader if available so we honor .env* precedence.
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(projectRoot, nodeEnv !== "production");
    return;
  } catch (error) {
    // Fallback for environments where @next/env is not installed (e.g. monorepo hoisting quirks).
    // This is expected in some monorepo setups, so we silently fall back to dotenv.
    if (error instanceof Error && !error.message.includes("@next/env")) {
      console.warn("[next.config] Failed to load @next/env, using dotenv fallback:", error.message);
    }
    const dotenv = require("dotenv");
    const files = [".env", `.env.${nodeEnv}`, ".env.local", `.env.${nodeEnv}.local`];
    for (const file of files) {
      dotenv.config({ path: path.join(projectRoot, file), override: true });
    }
  }
}

// Ensure Next picks up monorepo-root env files (including Clerk keys) in dev/build.
loadRootEnv();

function resolveCloudinaryCloudName() {
  const rawCloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
  if (rawCloudinaryUrl) {
    try {
      const parsed = new URL(rawCloudinaryUrl);
      if (parsed.protocol === "cloudinary:") {
        return parsed.hostname.replace(/\.cloudinary\.com$/i, "").trim() || null;
      }
    } catch {
      // Ignore here; Cloudinary validation is handled in shared env/API startup.
    }
  }

  return process.env.CLOUDINARY_CLOUD_NAME?.trim() || null;
}

function urlToRemotePattern(rawUrl) {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    return {
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const cloudinaryCloudName = resolveCloudinaryCloudName();
const dynamicBackendPatterns = [
  urlToRemotePattern(process.env.BACKEND_URL),
  urlToRemotePattern(process.env.NEXT_PUBLIC_BACKEND_URL),
  urlToRemotePattern(process.env.NEXT_PUBLIC_DOMAIN),
].filter(Boolean);

const remotePatterns = [
  {
    protocol: "https",
    hostname: "picsum.photos",
  },
  {
    protocol: "https",
    hostname: "via.placeholder.com",
  },
  {
    protocol: "http",
    hostname: "localhost",
    port: "3001",
    pathname: "/**",
  },
  {
    protocol: "http",
    hostname: "localhost",
    port: "3000",
    pathname: "/**",
  },
  cloudinaryCloudName
    ? {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: `/${cloudinaryCloudName}/**`,
      }
    : {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
  ...dynamicBackendPatterns,
];

const dedupedRemotePatterns = Array.from(
  new Map(remotePatterns.map((pattern) => [JSON.stringify(pattern), pattern])).values(),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Cache Components for PPR (Partial Prerendering)
  // Use 'use cache' directive granularly in functions/components that don't access runtime APIs
  cacheComponents: true,
  turbopack: {},
  images: {
    remotePatterns: dedupedRemotePatterns,
  },
};

export default nextConfig;
