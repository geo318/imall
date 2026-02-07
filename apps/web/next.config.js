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

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Cache Components for PPR (Partial Prerendering)
  // Use 'use cache' directive granularly in functions/components that don't access runtime APIs
  cacheComponents: true,
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
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
      },
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
