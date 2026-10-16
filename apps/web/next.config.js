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
  // Toggle via NEXT_CACHE_COMPONENTS=false to disable without touching source.
  // 'use cache' directives remain in source — they become no-ops when this is off.
  cacheComponents: process.env.NEXT_CACHE_COMPONENTS !== "false",
  // Next has separate incremental and Cache Components stores using this budget.
  // Keep both small enough for Render's 512 MB web container.
  cacheMaxMemorySize: 16 * 1024 * 1024,
  experimental: {
    imgOptConcurrency: 1,
    imgOptMaxInputPixels: 16_777_216,
  },
  turbopack: {},
  images: {
    remotePatterns: dedupedRemotePatterns,
  },
  async headers() {
    return [
      {
        // Prevent browsers from caching stale HTML/JS bundles that contain outdated
        // Server Action IDs. Clients holding old bundles call actions that no longer
        // exist after a new deployment, causing "Failed to find Server Action" errors.
        // Public catalog/image handlers supply their own bounded cache policy.
        // Preserve it while keeping private APIs and page HTML revalidated.
        source:
          "/((?!_next/static|_next/image|favicon.ico|api/image/|api/products(?:/search)?$|api/categories/tree$|api/shops/[^/]+/products$).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, must-revalidate",
          },
        ],
      },
      // Public files have stable URLs, so allow bounded caching rather than
      // making every font/logo request revalidate against the web container.
      // Keep page/API responses on the rule above and Next's hashed assets on
      // its own immutable caching policy.
      ...[
        "/fonts/:path*",
        "/templates/:path*",
        "/imall-logo.png",
        "/credo-bank-logo.png",
        "/crystal-bank-logo.png",
      ].map((source) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
          },
        ],
      })),
    ];
  },
};

export default nextConfig;
