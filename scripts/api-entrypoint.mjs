import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { ensureKeepzRsaKeys } from "./ensure-keepz-rsa-keys.mjs";

const now = () => new Date().toISOString();

function log(step, message, extra) {
  if (extra === undefined) {
    console.log(`[API-ENTRYPOINT] ${now()} [${step}] ${message}`);
    return;
  }
  console.log(`[API-ENTRYPOINT] ${now()} [${step}] ${message}`, extra);
}

function fail(message, error) {
  console.error(`[API-ENTRYPOINT] ${now()} [ERROR] ${message}`, error ?? "");
  process.exit(1);
}

function summarizeDatabaseUrl(value) {
  if (!value) return { present: false };

  try {
    const url = new URL(value);
    return {
      present: true,
      protocol: url.protocol.replace(":", ""),
      host: url.hostname || undefined,
      port: url.port || undefined,
      database: url.pathname.replace(/^\//, "") || undefined,
      sslmode: url.searchParams.get("sslmode") || undefined,
    };
  } catch {
    return { present: true, parseable: false };
  }
}

function parseCloudinaryCredentials() {
  const rawUrl = process.env.CLOUDINARY_URL?.trim();
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === "cloudinary:") {
        const cloudName = parsed.hostname.replace(/\.cloudinary\.com$/i, "").trim();
        const apiKey = decodeURIComponent(parsed.username || "").trim();
        const apiSecret = decodeURIComponent(parsed.password || "").trim();
        if (cloudName && apiKey && apiSecret) {
          return {
            configured: true,
            source: "cloudinary_url",
            cloudName,
          };
        }
      }
    } catch {
      // Keep entrypoint tolerant; API startup env validation will fail with details.
    }
  }

  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    return {
      configured: true,
      source: "segment_env",
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
  }

  return {
    configured: false,
    source: null,
    cloudName: null,
  };
}

function resolveKeepzRsaStateFile() {
  const configured = process.env.KEEPZ_RSA_STATE_FILE?.trim();
  if (configured) return configured;
  if (existsSync("/var/data")) return "/var/data/keepz-rsa-keys.env";
  return path.resolve(process.cwd(), ".env");
}

function runChecked(step, command, args) {
  const startedAt = Date.now();
  log(step, `Running: ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  const durationMs = Date.now() - startedAt;

  if (result.status !== 0) {
    fail(`${step} failed after ${durationMs}ms (exit ${result.status ?? "unknown"})`);
  }

  log(step, `Success in ${durationMs}ms`);
}

const keepzRsaStateFile = resolveKeepzRsaStateFile();

log("1/5", "Container startup diagnostics");
const cloudinary = parseCloudinaryCredentials();
log("1/5", "Runtime env", {
  nodeEnv: process.env.NODE_ENV ?? null,
  port: process.env.PORT ?? null,
  renderServiceName: process.env.RENDER_SERVICE_NAME ?? null,
  renderExternalUrl: process.env.RENDER_EXTERNAL_URL ?? null,
  domain: process.env.DOMAIN ?? null,
  nextPublicDomain: process.env.NEXT_PUBLIC_DOMAIN ?? null,
  domainSet: Boolean(process.env.DOMAIN),
  nextPublicDomainSet: Boolean(process.env.NEXT_PUBLIC_DOMAIN),
  databaseUrl: summarizeDatabaseUrl(process.env.DATABASE_URL),
  imageStorageProvider: process.env.IMAGE_STORAGE_PROVIDER ?? null,
  cloudinaryConfigured: cloudinary.configured,
  cloudinarySource: cloudinary.source,
  cloudinaryCloudName: cloudinary.cloudName,
  keepzRsaStateFile,
});

log("2/5", "Ensuring Keepz/Credo RSA keypair");
const keepzKeyResult = ensureKeepzRsaKeys({
  env: process.env,
  envFilePath: keepzRsaStateFile,
  write: true,
  targetPrefix: "CREDO",
  logger: (message) => log("2/5", message),
});
log("2/5", "Keepz/Credo RSA state", {
  generated: keepzKeyResult.generated,
  source: keepzKeyResult.source,
  stateFile: keepzRsaStateFile,
});

log("3/5", "Running database migrations (db:push:ci, non-interactive)");
runChecked("3/5", "bun", ["run", "db:push:ci"]);

log("4/5", "Starting API process");
const child = spawn("bun", ["apps/api/dist/index.js"], { stdio: "inherit" });

const forwardSignal = (signal) => {
  log("4/5", `Forwarding signal ${signal} to API process`);
  child.kill(signal);
};

process.on("SIGTERM", () => forwardSignal("SIGTERM"));
process.on("SIGINT", () => forwardSignal("SIGINT"));

child.on("error", (error) => fail("Failed to spawn API process", error));
child.on("exit", (code, signal) => {
  if (signal) {
    log("5/5", `API process exited via signal ${signal}`);
    process.exit(0);
  }

  log("5/5", `API process exited with code ${code ?? 0}`);
  process.exit(code ?? 0);
});
