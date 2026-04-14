import {
  constants,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";
import { env } from "../context";
import { logger } from "../utils/logger";

const DEFAULT_KEEPZ_ECOMMERCE_BASE_URL = "https://gateway.dev.keepz.me/ecommerce-service";

type KeepzEncryptedEnvelope = {
  identifier: string;
  encryptedData: string;
  encryptedKeys: string;
  aes: true;
};

type KeepzErrorPayload = {
  message?: unknown;
  statusCode?: unknown;
  exceptionGroup?: unknown;
};

type KeepzOrderStatus =
  | "INITIAL"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELED"
  | "EXPIRED"
  | "REFUND_REQUESTED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED_BY_OPERATOR"
  | "REFUNDED_BY_INTEGRATOR"
  | "REFUNDED_BY_KEEPZ"
  | "REFUNDED_FAILED"
  | string;

export type KeepzOrderType = "card" | "installments";

export type StartKeepzOrderInput = {
  amount: number;
  integratorOrderId: string;
  type: KeepzOrderType;
  callbackUri?: string;
  successRedirectUri?: string;
  failRedirectUri?: string;
  language?: "EN" | "IT" | "KA";
  personalNumber?: string;
  isForeign?: boolean;
};

export type KeepzStatusResult = {
  integratorOrderId: string;
  status: KeepzOrderStatus;
  raw: unknown;
};

export class KeepzApiError extends Error {
  readonly httpStatus: number;
  readonly keepzStatusCode: number | null;
  readonly exceptionGroup: number | null;
  readonly raw: unknown;

  constructor(
    message: string,
    options: {
      httpStatus: number;
      keepzStatusCode?: number | null;
      exceptionGroup?: number | null;
      raw?: unknown;
    },
  ) {
    super(message);
    this.name = "KeepzApiError";
    this.httpStatus = options.httpStatus;
    this.keepzStatusCode = options.keepzStatusCode ?? null;
    this.exceptionGroup = options.exceptionGroup ?? null;
    this.raw = options.raw ?? null;
  }
}

type KeepzConfig = {
  baseUrl: string;
  identifier: string;
  integratorId: string;
  receiverId: string;
  receiverType: "BRANCH";
  publicKey: string;
  privateKey: string;
  installmentProvider: "CREDO";
  defaultCardProvider: "DEFAULT" | "BOG" | "TBC" | "CREDO";
};

type KeepzResolvedCredentials = {
  identifier: string | null;
  integratorId: string | null;
  receiverId: string | null;
  publicKey: string | null;
  privateKey: string | null;
  usingCredoFallback: boolean;
  identifierSource: string;
  integratorIdSource: string;
  receiverIdSource: string;
  publicKeySource: "KEEPZ_RSA_PUBLIC_KEY" | "CREDO_RSA_PUBLIC_KEY";
  privateKeySource: "KEEPZ_RSA_PRIVATE_KEY" | "CREDO_RSA_PRIVATE_KEY";
};

const KEEPZ_DESERIALIZE_ERROR_PATTERN = /(can'?t|cannot)\s+deserialize\s+object/i;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class KeepzConfigError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "KeepzConfigError";
    this.details = details ?? {};
  }
}

function asFiniteNumber(value: unknown): number | null {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numericValue) ? numericValue : null;
}

function stripPemMarkers(value: string): string {
  return value
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
}

function resolveBaseUrl(): string {
  const configured = env.KEEPZ_ECOMMERCE_BASE_URL?.trim();
  const raw = configured || DEFAULT_KEEPZ_ECOMMERCE_BASE_URL;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

function resolveKeepzCredentials(): KeepzResolvedCredentials {
  const merchantId = env.CREDO_MERCHANT_ID?.trim() || null;
  const merchantIdUuid = isUuidV4(merchantId) ? merchantId : null;
  const credoPublicKey = process.env.CREDO_RSA_PUBLIC_KEY?.trim() || null;
  const credoPrivateKey = process.env.CREDO_RSA_PRIVATE_KEY?.trim() || null;

  const keepzIdentifier = env.KEEPZ_INTEGRATOR_IDENTIFIER?.trim() || null;
  const keepzIntegratorId = env.KEEPZ_INTEGRATOR_ID?.trim() || null;
  const keepzReceiverId = env.KEEPZ_RECEIVER_ID?.trim() || null;
  const identifier = keepzIdentifier || merchantIdUuid;
  const integratorId = keepzIntegratorId || merchantIdUuid;
  const receiverId = keepzReceiverId || merchantIdUuid;
  const publicKey = env.KEEPZ_RSA_PUBLIC_KEY?.trim() || credoPublicKey;
  const privateKey = env.KEEPZ_RSA_PRIVATE_KEY?.trim() || credoPrivateKey;

  const usingCredoFallback = Boolean(
    merchantIdUuid && (!keepzIdentifier || !keepzIntegratorId || !keepzReceiverId),
  );

  const identifierSource = keepzIdentifier
    ? "KEEPZ_INTEGRATOR_IDENTIFIER"
    : merchantIdUuid
      ? "CREDO_MERCHANT_ID"
      : merchantId
        ? "missing (CREDO_MERCHANT_ID is not UUID v4)"
        : "missing";
  const integratorIdSource = keepzIntegratorId
    ? "KEEPZ_INTEGRATOR_ID"
    : merchantIdUuid
      ? "CREDO_MERCHANT_ID"
      : merchantId
        ? "missing (CREDO_MERCHANT_ID is not UUID v4)"
        : "missing";
  const receiverIdSource = keepzReceiverId
    ? "KEEPZ_RECEIVER_ID"
    : merchantIdUuid
      ? "CREDO_MERCHANT_ID"
      : merchantId
        ? "missing (CREDO_MERCHANT_ID is not UUID v4)"
        : "missing";

  return {
    identifier,
    integratorId,
    receiverId,
    publicKey,
    privateKey,
    usingCredoFallback,
    identifierSource,
    integratorIdSource,
    receiverIdSource,
    publicKeySource: env.KEEPZ_RSA_PUBLIC_KEY?.trim()
      ? "KEEPZ_RSA_PUBLIC_KEY"
      : "CREDO_RSA_PUBLIC_KEY",
    privateKeySource: env.KEEPZ_RSA_PRIVATE_KEY?.trim()
      ? "KEEPZ_RSA_PRIVATE_KEY"
      : "CREDO_RSA_PRIVATE_KEY",
  };
}

function isUuidV4(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_V4_PATTERN.test(value.trim());
}

function parsePublicKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return createPublicKey(trimmed);
  }

  const normalized = stripPemMarkers(trimmed);
  return createPublicKey({
    key: Buffer.from(normalized, "base64"),
    format: "der",
    type: "spki",
  });
}

function parsePrivateKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN PRIVATE KEY")) {
    return createPrivateKey(trimmed);
  }

  const normalized = stripPemMarkers(trimmed);
  return createPrivateKey({
    key: Buffer.from(normalized, "base64"),
    format: "der",
    type: "pkcs8",
  });
}

function getKeepzConfig(): KeepzConfig {
  const resolved = resolveKeepzCredentials();
  const { identifier, integratorId, receiverId, publicKey, privateKey } = resolved;

  if (!identifier) {
    throw new KeepzConfigError(
      "KEEPZ_INTEGRATOR_IDENTIFIER is required (UUID v4 from Keepz). CREDO_MERCHANT_ID fallback works only if it is UUID v4.",
      {
        field: "identifier",
        source: resolved.identifierSource,
      },
    );
  }
  if (!integratorId) {
    throw new KeepzConfigError(
      "KEEPZ_INTEGRATOR_ID is required (UUID v4 from Keepz). CREDO_MERCHANT_ID fallback works only if it is UUID v4.",
      {
        field: "integratorId",
        source: resolved.integratorIdSource,
      },
    );
  }
  if (!receiverId) {
    throw new KeepzConfigError(
      "KEEPZ_RECEIVER_ID is required (UUID v4 from Keepz). CREDO_MERCHANT_ID fallback works only if it is UUID v4.",
      {
        field: "receiverId",
        source: resolved.receiverIdSource,
      },
    );
  }
  if (!isUuidV4(identifier)) {
    throw new KeepzConfigError(
      `Keepz identifier must be UUID v4. Received "${identifier}" from ${resolved.identifierSource}.`,
      {
        field: "identifier",
        source: resolved.identifierSource,
        received: identifier,
      },
    );
  }
  if (!isUuidV4(integratorId)) {
    throw new KeepzConfigError(
      `Keepz integratorId must be UUID v4. Received "${integratorId}" from ${resolved.integratorIdSource}.`,
      {
        field: "integratorId",
        source: resolved.integratorIdSource,
        received: integratorId,
      },
    );
  }
  if (!isUuidV4(receiverId)) {
    throw new KeepzConfigError(
      `Keepz receiverId must be UUID v4. Received "${receiverId}" from ${resolved.receiverIdSource}.`,
      {
        field: "receiverId",
        source: resolved.receiverIdSource,
        received: receiverId,
      },
    );
  }
  if (!publicKey) {
    throw new KeepzConfigError(
      "KEEPZ_RSA_PUBLIC_KEY (or CREDO_RSA_PUBLIC_KEY fallback) is not configured",
      {
        field: "publicKey",
        source: resolved.publicKeySource,
      },
    );
  }
  if (!privateKey) {
    throw new KeepzConfigError(
      "KEEPZ_RSA_PRIVATE_KEY (or CREDO_RSA_PRIVATE_KEY fallback) is not configured",
      {
        field: "privateKey",
        source: resolved.privateKeySource,
      },
    );
  }

  return {
    baseUrl: resolveBaseUrl(),
    identifier,
    integratorId,
    receiverId,
    receiverType: "BRANCH",
    publicKey,
    privateKey,
    installmentProvider: "CREDO",
    defaultCardProvider:
      (env.KEEPZ_DEFAULT_DIRECT_LINK_PROVIDER as "DEFAULT" | "BOG" | "TBC" | "CREDO" | undefined) ||
      "DEFAULT",
  };
}

export function isKeepzEcommerceConfigured(): boolean {
  const { identifier, integratorId, receiverId, publicKey, privateKey } =
    resolveKeepzCredentials();
  return Boolean(
    identifier &&
      integratorId &&
      receiverId &&
      publicKey &&
      privateKey &&
      isUuidV4(identifier) &&
      isUuidV4(integratorId) &&
      isUuidV4(receiverId),
  );
}

export function getKeepzConfigDiagnostics() {
  const resolved = resolveKeepzCredentials();
  const identifierFormatValid = isUuidV4(resolved.identifier);
  const integratorIdFormatValid = isUuidV4(resolved.integratorId);
  const receiverIdFormatValid = isUuidV4(resolved.receiverId);
  return {
    configured: Boolean(
      resolved.identifier &&
        resolved.integratorId &&
        resolved.receiverId &&
        resolved.publicKey &&
        resolved.privateKey &&
        identifierFormatValid &&
        integratorIdFormatValid &&
        receiverIdFormatValid,
    ),
    usingCredoFallback: resolved.usingCredoFallback,
    identifierSource: resolved.identifierSource,
    integratorIdSource: resolved.integratorIdSource,
    receiverIdSource: resolved.receiverIdSource,
    publicKeySource: resolved.publicKeySource,
    privateKeySource: resolved.privateKeySource,
    identifierFormatValid,
    integratorIdFormatValid,
    receiverIdFormatValid,
  };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isEncryptedResponse(value: unknown): value is {
  encryptedData: string;
  encryptedKeys: string;
  aes?: boolean;
} {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.encryptedData === "string" && typeof payload.encryptedKeys === "string";
}

function serializeKeepzError(
  responseStatus: number,
  payload: unknown,
  fallbackMessage: string,
): KeepzApiError {
  const parsed = (payload && typeof payload === "object" ? payload : {}) as KeepzErrorPayload;
  const rawMessage = typeof parsed.message === "string" ? parsed.message.trim() : "";
  const message = KEEPZ_DESERIALIZE_ERROR_PATTERN.test(rawMessage)
    ? "Keepz rejected encrypted payload (can't deserialize object). Verify RSA keys and integrator credentials."
    : rawMessage || fallbackMessage;
  const statusCode = asFiniteNumber(parsed.statusCode);
  const exceptionGroup = asFiniteNumber(parsed.exceptionGroup);

  return new KeepzApiError(message, {
    httpStatus: responseStatus,
    keepzStatusCode: statusCode,
    exceptionGroup,
    raw: payload,
  });
}

function summarizeRecordKeys(payload: Record<string, unknown>): string[] {
  return Object.keys(payload).sort((a, b) => a.localeCompare(b));
}

function sanitizeKeepzDebugValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (key === "encryptedData" || key === "encryptedKeys") {
      const length = typeof entry === "string" ? entry.length : null;
      sanitized[key] = `<redacted length=${length ?? "n/a"}>`;
      continue;
    }

    if (typeof entry === "string" && entry.length > 500) {
      sanitized[key] = `${entry.slice(0, 500)}…`;
      continue;
    }

    sanitized[key] = entry;
  }

  return sanitized;
}

function encryptPayload(payload: unknown, publicKeyInput: string): Omit<KeepzEncryptedEnvelope, "identifier"> {
  const aesKey = randomBytes(32);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", aesKey, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encryptedData = Buffer.concat([cipher.update(plaintext), cipher.final()]).toString("base64");

  const encodedKey = aesKey.toString("base64");
  const encodedIv = iv.toString("base64");
  const concatenated = `${encodedKey}.${encodedIv}`;
  const encryptedKeysBuffer = publicEncrypt(
    {
      key: parsePublicKey(publicKeyInput),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(concatenated, "utf8"),
  );

  return {
    encryptedData,
    encryptedKeys: encryptedKeysBuffer.toString("base64"),
    aes: true,
  };
}

function decryptPayload(
  encryptedData: string,
  encryptedKeys: string,
  privateKeyInput: string,
): unknown {
  const decryptedKeys = privateDecrypt(
    {
      key: parsePrivateKey(privateKeyInput),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encryptedKeys, "base64"),
  ).toString("utf8");

  const delimiterIndex = decryptedKeys.indexOf(".");
  if (delimiterIndex === -1) {
    throw new Error("Keepz encryptedKeys payload is invalid");
  }

  const encodedAesKey = decryptedKeys.slice(0, delimiterIndex);
  const encodedIv = decryptedKeys.slice(delimiterIndex + 1);
  const aesKey = Buffer.from(encodedAesKey, "base64");
  const iv = Buffer.from(encodedIv, "base64");
  const decipher = createDecipheriv("aes-256-cbc", aesKey, iv);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, "base64")),
    decipher.final(),
  ]).toString("utf8");

  const parsed = safeJsonParse(decrypted);
  return parsed ?? decrypted;
}

export function decryptKeepzEnvelope(envelope: { encryptedData: string; encryptedKeys: string }): unknown {
  const config = getKeepzConfig();
  return decryptPayload(envelope.encryptedData, envelope.encryptedKeys, config.privateKey);
}

async function requestKeepz(
  path: string,
  method: "GET" | "POST" | "DELETE",
  payload: Record<string, unknown>,
): Promise<unknown> {
  const config = getKeepzConfig();
  const encrypted = encryptPayload(payload, config.publicKey);
  const envelope: KeepzEncryptedEnvelope = {
    identifier: config.identifier,
    encryptedData: encrypted.encryptedData,
    encryptedKeys: encrypted.encryptedKeys,
    aes: true,
  };

  const url = new URL(path, config.baseUrl);
  const requestInit: RequestInit = {
    method,
    headers: {
      Accept: "application/json",
    },
  };

  if (method === "GET" || method === "DELETE") {
    url.searchParams.set("identifier", envelope.identifier);
    url.searchParams.set("encryptedData", envelope.encryptedData);
    url.searchParams.set("encryptedKeys", envelope.encryptedKeys);
    url.searchParams.set("aes", "true");
  } else {
    requestInit.headers = {
      ...requestInit.headers,
      "Content-Type": "application/json",
    };
    requestInit.body = JSON.stringify(envelope);
  }

  logger.debug("[Keepz API] Request", {
    path,
    method,
    url: url.toString(),
    payloadKeys: summarizeRecordKeys(payload),
    encryptedDataLength: envelope.encryptedData.length,
    encryptedKeysLength: envelope.encryptedKeys.length,
  });

  let response: Response;
  try {
    response = await fetch(url.toString(), requestInit);
  } catch (error) {
    logger.error("[Keepz API] Network request failed", {
      path,
      method,
      url: url.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
    throw new KeepzApiError("Keepz request failed due to network error", {
      httpStatus: 502,
      raw: {
        path,
        method,
        networkError: error instanceof Error ? error.message : String(error),
      },
    });
  }

  const rawText = await response.text();
  const parsed = rawText ? safeJsonParse(rawText) : null;
  logger.debug("[Keepz API] Response", {
    path,
    method,
    status: response.status,
    ok: response.ok,
    responseKeys:
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? summarizeRecordKeys(parsed as Record<string, unknown>)
        : null,
    rawPreview: rawText ? sanitizeKeepzDebugValue(rawText) : null,
  });

  if (!response.ok) {
    throw serializeKeepzError(
      response.status,
      parsed ?? rawText,
      `Keepz request failed (${response.status})`,
    );
  }

  if (isEncryptedResponse(parsed)) {
    try {
      return decryptPayload(parsed.encryptedData, parsed.encryptedKeys, config.privateKey);
    } catch (error) {
      logger.error("[Keepz API] Failed to decrypt encrypted response", {
        path,
        method,
        status: response.status,
        error: error instanceof Error ? error.message : String(error),
        response: sanitizeKeepzDebugValue(parsed),
      });
      throw new KeepzApiError(
        "Failed to decrypt Keepz response. Verify RSA keys and environment configuration.",
        {
          httpStatus: 502,
          raw: {
            path,
            method,
            responseStatus: response.status,
            decryptError: error instanceof Error ? error.message : String(error),
            response: sanitizeKeepzDebugValue(parsed),
          },
        },
      );
    }
  }

  // Some callbacks/legacy endpoints may return plain payloads.
  return parsed ?? rawText;
}

function normalizePersonalNumber(rawValue: string): string {
  return rawValue.replace(/\D/g, "");
}

function normalizeAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Keepz amount must be greater than zero");
  }

  return Number(value.toFixed(2));
}

function normalizeKeepzStatus(status: unknown): KeepzOrderStatus {
  if (typeof status !== "string" || !status.trim()) return "UNKNOWN";
  return status.trim().toUpperCase();
}

function buildCreateOrderPayload(
  input: StartKeepzOrderInput,
  config: KeepzConfig,
  options: { includeDirectLink: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    amount: normalizeAmount(input.amount),
    receiverId: config.receiverId,
    receiverType: config.receiverType,
    integratorId: config.integratorId,
    integratorOrderId: input.integratorOrderId,
    language: input.language || env.KEEPZ_DEFAULT_LANGUAGE || undefined,
  };

  if (input.callbackUri?.trim()) {
    payload.callbackUri = input.callbackUri.trim();
  }
  if (input.successRedirectUri?.trim()) {
    payload.successRedirectUri = input.successRedirectUri.trim();
  }
  if (input.failRedirectUri?.trim()) {
    payload.failRedirectUri = input.failRedirectUri.trim();
  }

  if (!options.includeDirectLink) {
    // Provider-specific direct-link fields are omitted intentionally.
    // Keepz will return generic checkout URL with payment method selection.
    return payload;
  }

  if (input.type === "installments") {
    const normalizedPersonalNumber = normalizePersonalNumber(input.personalNumber || "");
    if (!normalizedPersonalNumber) {
      throw new Error("personalNumber is required for Keepz installments");
    }
    if (normalizedPersonalNumber.length !== 9 && normalizedPersonalNumber.length !== 11) {
      throw new Error("personalNumber must contain exactly 9 or 11 digits");
    }

    payload.installmentPaymentProvider = config.installmentProvider;
    payload.personalNumber = normalizedPersonalNumber;
    payload.isForeign = Boolean(input.isForeign);
  } else {
    payload.directLinkProvider = config.defaultCardProvider;
  }

  return payload;
}

export async function createKeepzOrder(
  input: StartKeepzOrderInput,
): Promise<{ integratorOrderId: string; redirectUrl: string; raw: unknown }> {
  const config = getKeepzConfig();
  let rawResponse: unknown;
  try {
    rawResponse = await requestKeepz(
      "api/integrator/order",
      "POST",
      buildCreateOrderPayload(input, config, { includeDirectLink: true }),
    );
  } catch (error) {
    if (!(error instanceof KeepzApiError) || error.keepzStatusCode !== 6033) {
      throw error;
    }

    logger.warn("[Keepz API] Direct-link permission missing. Retrying order without provider.", {
      integratorOrderId: input.integratorOrderId,
      type: input.type,
      keepzStatusCode: error.keepzStatusCode,
      exceptionGroup: error.exceptionGroup,
      keepzMessage: error.message,
    });

    rawResponse = await requestKeepz(
      "api/integrator/order",
      "POST",
      buildCreateOrderPayload(input, config, { includeDirectLink: false }),
    );
  }
  const parsed = (rawResponse && typeof rawResponse === "object" ? rawResponse : null) as {
    integratorOrderId?: unknown;
    urlForQR?: unknown;
  } | null;

  const redirectUrl = typeof parsed?.urlForQR === "string" ? parsed.urlForQR.trim() : "";
  const integratorOrderId =
    typeof parsed?.integratorOrderId === "string"
      ? parsed.integratorOrderId.trim()
      : input.integratorOrderId;

  if (!redirectUrl) {
    throw new Error("Keepz create order succeeded but urlForQR is missing");
  }

  return {
    integratorOrderId,
    redirectUrl,
    raw: rawResponse,
  };
}

export async function getKeepzOrderStatus(integratorOrderId: string): Promise<KeepzStatusResult> {
  const config = getKeepzConfig();
  const rawResponse = await requestKeepz("api/integrator/order/status", "GET", {
    integratorId: config.integratorId,
    integratorOrderId,
  });

  const parsed = (rawResponse && typeof rawResponse === "object" ? rawResponse : null) as {
    integratorOrderId?: unknown;
    status?: unknown;
  } | null;

  return {
    integratorOrderId:
      typeof parsed?.integratorOrderId === "string"
        ? parsed.integratorOrderId
        : integratorOrderId,
    status: normalizeKeepzStatus(parsed?.status),
    raw: rawResponse,
  };
}

export async function cancelKeepzOrder(
  integratorOrderId: string,
): Promise<{ integratorOrderId: string; status: KeepzOrderStatus; raw: unknown }> {
  const config = getKeepzConfig();
  const rawResponse = await requestKeepz("api/integrator/order/cancel", "DELETE", {
    integratorId: config.integratorId,
    integratorOrderId,
  });

  const parsed = (rawResponse && typeof rawResponse === "object" ? rawResponse : null) as {
    integratorOrderId?: unknown;
    status?: unknown;
  } | null;

  return {
    integratorOrderId:
      typeof parsed?.integratorOrderId === "string"
        ? parsed.integratorOrderId
        : integratorOrderId,
    status: normalizeKeepzStatus(parsed?.status),
    raw: rawResponse,
  };
}

export async function refundKeepzOrder(input: {
  integratorOrderId: string;
  amount: number;
  refundInitiator?: "INTEGRATOR" | "OPERATOR";
}): Promise<{ integratorOrderId: string; status: KeepzOrderStatus; raw: unknown }> {
  const config = getKeepzConfig();
  const rawResponse = await requestKeepz("api/integrator/order/refund/v2", "POST", {
    integratorId: config.integratorId,
    integratorOrderId: input.integratorOrderId,
    amount: normalizeAmount(input.amount),
    refundInitiator: input.refundInitiator || "INTEGRATOR",
  });

  const parsed = (rawResponse && typeof rawResponse === "object" ? rawResponse : null) as {
    integratorOrderId?: unknown;
    status?: unknown;
  } | null;

  return {
    integratorOrderId:
      typeof parsed?.integratorOrderId === "string"
        ? parsed.integratorOrderId
        : input.integratorOrderId,
    status: normalizeKeepzStatus(parsed?.status),
    raw: rawResponse,
  };
}
