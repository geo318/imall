import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_PREFIXES = ["KEEPZ", "CREDO"];

function normalizeEnvValue(value) {
  if (value === undefined || value === null) return "";
  let normalized = String(value).trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  if (normalized === "''" || normalized === '""') return "";
  return normalized;
}

function parseEnvContent(content) {
  const map = new Map();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    const rawValue = match[2] ?? "";
    map.set(key, normalizeEnvValue(rawValue));
  }
  return map;
}

function readEnvMap(envFilePath) {
  if (!envFilePath || !existsSync(envFilePath)) {
    return { map: new Map(), source: null };
  }

  const raw = readFileSync(envFilePath, "utf8");
  return {
    map: parseEnvContent(raw),
    source: envFilePath,
  };
}

function resolveValue({ env, fileMap, key }) {
  const envValue = normalizeEnvValue(env[key]);
  if (envValue) return envValue;
  return normalizeEnvValue(fileMap.get(key));
}

function keyNames(prefix) {
  return {
    publicKeyName: `${prefix}_RSA_PUBLIC_KEY`,
    privateKeyName: `${prefix}_RSA_PRIVATE_KEY`,
  };
}

function resolvePair({ env, fileMap, prefix }) {
  const { publicKeyName, privateKeyName } = keyNames(prefix);
  const publicKey = resolveValue({ env, fileMap, key: publicKeyName });
  const privateKey = resolveValue({ env, fileMap, key: privateKeyName });

  if (!publicKey || !privateKey) return null;

  return {
    prefix,
    publicKeyName,
    privateKeyName,
    publicKey,
    privateKey,
  };
}

function resolveExistingPair({ env, fileMap }) {
  for (const prefix of SUPPORTED_PREFIXES) {
    const pair = resolvePair({ env, fileMap, prefix });
    if (pair) return pair;
  }

  return null;
}

function generatePairBase64() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "der",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "der",
    },
  });

  return {
    publicKey: Buffer.from(publicKey).toString("base64"),
    privateKey: Buffer.from(privateKey).toString("base64"),
  };
}

function upsertEnvPairs({ envFilePath, updates, logger }) {
  mkdirSync(path.dirname(envFilePath), { recursive: true });
  const existing = existsSync(envFilePath) ? readFileSync(envFilePath, "utf8") : "";
  const lines = existing ? existing.split(/\r?\n/) : [];
  const keyToIndex = new Map();

  lines.forEach((line, index) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) keyToIndex.set(match[1], index);
  });

  if (lines.length === 0) {
    lines.push("# Generated Keepz/Credo RSA keys");
  }

  for (const [key, value] of Object.entries(updates)) {
    const sanitized = String(value).replace(/\r?\n/g, "");
    const nextLine = `${key}=${sanitized}`;
    if (keyToIndex.has(key)) {
      const idx = keyToIndex.get(key);
      if (idx !== undefined) lines[idx] = nextLine;
    } else {
      lines.push(nextLine);
    }
  }

  const next = `${lines.join("\n").replace(/\n+$/g, "")}\n`;
  writeFileSync(envFilePath, next, { mode: 0o600 });
  logger?.(`[keepz-keys] persisted keypair to ${envFilePath}`);
}

export function ensureKeepzRsaKeys({
  env = process.env,
  envFilePath = path.resolve(process.cwd(), ".env"),
  write = false,
  force = false,
  targetPrefix = "CREDO",
  logger = console.log,
} = {}) {
  const { map: fileMap, source } = readEnvMap(envFilePath);
  const existingPair = resolveExistingPair({ env, fileMap });
  const { publicKeyName: targetPublicKeyName, privateKeyName: targetPrivateKeyName } =
    keyNames(targetPrefix);

  if (!force && existingPair) {
    env[existingPair.publicKeyName] = existingPair.publicKey;
    env[existingPair.privateKeyName] = existingPair.privateKey;
    logger?.(
      `[keepz-keys] existing RSA keypair found (${existingPair.prefix}${
        source ? ` via ${source}` : ""
      }), skipping generation`,
    );
    return {
      generated: false,
      source: existingPair.prefix,
    };
  }

  const pair = generatePairBase64();
  env[targetPublicKeyName] = pair.publicKey;
  env[targetPrivateKeyName] = pair.privateKey;

  if (write && envFilePath) {
    upsertEnvPairs({
      envFilePath,
      updates: {
        [targetPublicKeyName]: pair.publicKey,
        [targetPrivateKeyName]: pair.privateKey,
      },
      logger,
    });
  }

  logger?.(`[keepz-keys] generated new RSA keypair (${targetPrefix})`);
  return {
    generated: true,
    source: targetPrefix,
  };
}

function parseCliArgs(argv) {
  const args = new Set(
    argv.filter((arg, index) => arg !== "--target-prefix" && argv[index - 1] !== "--target-prefix"),
  );
  const force = args.has("--force");
  const write = args.has("--write") || args.has("--persist");
  const useKeepzPrefix = args.has("--keepz-prefix") || args.has("--target-prefix=KEEPZ");
  const explicitTargetPrefixIndex = argv.indexOf("--target-prefix");
  const explicitTargetPrefix =
    explicitTargetPrefixIndex >= 0 && argv[explicitTargetPrefixIndex + 1]
      ? String(argv[explicitTargetPrefixIndex + 1]).toUpperCase()
      : null;
  const envFileArgIndex = argv.indexOf("--env-file");
  const envFilePath =
    envFileArgIndex >= 0 && argv[envFileArgIndex + 1]
      ? path.resolve(process.cwd(), argv[envFileArgIndex + 1])
      : path.resolve(process.cwd(), ".env");

  const targetPrefixCandidate = explicitTargetPrefix || (useKeepzPrefix ? "KEEPZ" : "CREDO");
  const targetPrefix = SUPPORTED_PREFIXES.includes(targetPrefixCandidate)
    ? targetPrefixCandidate
    : "CREDO";

  return {
    force,
    write,
    targetPrefix,
    envFilePath,
  };
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  const { force, write, targetPrefix, envFilePath } = parseCliArgs(process.argv.slice(2));
  ensureKeepzRsaKeys({
    force,
    write,
    targetPrefix,
    envFilePath,
  });
}
