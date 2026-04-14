import { env } from "../context";
import { logger } from "../utils/logger";

const DEFAULT_KEEPZ_DIRECT_SETTLEMENTS_BASE_URL = "https://distributor.dev.keepz.me";
const DEFAULT_GRANT_TYPE = "client_credentials";
const TOKEN_EXPIRY_SKEW_MS = 30_000;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type KeepzDirectSettlementsCurrency = "GEL" | "USD" | "EUR";
export type KeepzDirectSettlementsReceiverType = "BRANCH" | "USER";

type KeepzDirectSettlementsAuthPayload = {
  value?: {
    access_token?: unknown;
    expires_in?: unknown;
    token_type?: unknown;
  } | null;
  message?: unknown;
  statusCode?: unknown;
};

type KeepzDirectSettlementsConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  grantType: "client_credentials";
};

type KeepzDirectSettlementsRequestOptions = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

type KeepzDirectSettlementsTokenCache = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
};

export type KeepzDirectSettlementsCreateTransactionInput = {
  amount: number;
  currency: KeepzDirectSettlementsCurrency;
  description: string;
  beneficiaryIdentityNumber?: string;
  beneficiaryName?: string;
  beneficiaryAddress?: string;
  toIban?: string;
  receiverId?: string;
  receiverType?: KeepzDirectSettlementsReceiverType;
  birthDate?: string;
  uniqueId?: string;
  debtorName?: string;
  debtorIban?: string;
  debtorIdentityNumber?: string;
};

export type KeepzDirectSettlementsCreateTransactionResult = {
  transactionId: number;
  status: string;
  statusDescription: string | null;
  uniqueId: string;
  createdAt: string | null;
  raw: unknown;
};

export type KeepzDirectSettlementsTransactionDetails = {
  transactionId: number;
  status: string;
  statusDescription: string | null;
  amount: number | null;
  toIban: string | null;
  currency: string | null;
  paymentDescription: string | null;
  uniqueId: string | null;
  createdAt: string | null;
  commissionAmount: number | null;
  raw: unknown;
};

export type KeepzDirectSettlementsBalanceResult = {
  amount: number;
  currency: KeepzDirectSettlementsCurrency | null;
  raw: unknown;
};

export class KeepzDirectSettlementsConfigError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "KeepzDirectSettlementsConfigError";
    this.details = details ?? {};
  }
}

export class KeepzDirectSettlementsApiError extends Error {
  readonly httpStatus: number;
  readonly statusCode: number | null;
  readonly raw: unknown;
  readonly path: string;
  readonly method: string;

  constructor(
    message: string,
    options: {
      httpStatus: number;
      statusCode?: number | null;
      raw?: unknown;
      path: string;
      method: string;
    },
  ) {
    super(message);
    this.name = "KeepzDirectSettlementsApiError";
    this.httpStatus = options.httpStatus;
    this.statusCode = options.statusCode ?? null;
    this.raw = options.raw ?? null;
    this.path = options.path;
    this.method = options.method;
  }
}

let accessTokenCache: KeepzDirectSettlementsTokenCache | null = null;

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isUuidV4(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_V4_PATTERN.test(value.trim());
}

function asFiniteNumber(value: unknown): number | null {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numericValue) ? numericValue : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeBaseUrl(rawValue: string): string {
  const trimmed = rawValue.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero");
  }
  return Number(amount.toFixed(2));
}

function resolveConfig(): KeepzDirectSettlementsConfig {
  const clientId = env.KEEPZ_DIRECT_SETTLEMENTS_CLIENT_ID?.trim() || "";
  const clientSecret = env.KEEPZ_DIRECT_SETTLEMENTS_CLIENT_SECRET?.trim() || "";
  const baseUrl = normalizeBaseUrl(
    env.KEEPZ_DIRECT_SETTLEMENTS_BASE_URL || DEFAULT_KEEPZ_DIRECT_SETTLEMENTS_BASE_URL,
  );

  if (!clientId) {
    throw new KeepzDirectSettlementsConfigError(
      "KEEPZ_DIRECT_SETTLEMENTS_CLIENT_ID is required for Keepz Direct Settlements",
      { field: "clientId" },
    );
  }
  if (!isUuidV4(clientId)) {
    throw new KeepzDirectSettlementsConfigError(
      `KEEPZ_DIRECT_SETTLEMENTS_CLIENT_ID must be UUID v4, received "${clientId}"`,
      {
        field: "clientId",
        value: clientId,
      },
    );
  }
  if (!clientSecret) {
    throw new KeepzDirectSettlementsConfigError(
      "KEEPZ_DIRECT_SETTLEMENTS_CLIENT_SECRET is required for Keepz Direct Settlements",
      { field: "clientSecret" },
    );
  }

  return {
    baseUrl,
    clientId,
    clientSecret,
    grantType: DEFAULT_GRANT_TYPE,
  };
}

function getMessageFromPayload(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;
  const value = record.message;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStatusCodeFromPayload(payload: unknown): number | null {
  const record = asRecord(payload);
  if (!record) return null;
  return asFiniteNumber(record.statusCode);
}

function buildApiError(
  fallbackMessage: string,
  options: {
    httpStatus: number;
    payload: unknown;
    path: string;
    method: string;
  },
): KeepzDirectSettlementsApiError {
  const message = getMessageFromPayload(options.payload) || fallbackMessage;
  const statusCode = getStatusCodeFromPayload(options.payload);
  return new KeepzDirectSettlementsApiError(message, {
    httpStatus: options.httpStatus,
    statusCode,
    raw: options.payload,
    path: options.path,
    method: options.method,
  });
}

function withQuery(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function parseTokenPayload(payload: unknown): {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
} {
  const record = asRecord(payload);
  const value = asRecord(record?.value);
  const accessToken =
    value && typeof value.access_token === "string" ? value.access_token.trim() : "";
  if (!accessToken) {
    throw new Error("Keepz auth response is missing access_token");
  }

  const tokenType =
    value && typeof value.token_type === "string" && value.token_type.trim()
      ? value.token_type.trim()
      : "Bearer";
  const expiresInSeconds = asFiniteNumber(value?.expires_in) ?? 3600;
  return {
    accessToken,
    tokenType,
    expiresInSeconds: Math.max(10, Math.floor(expiresInSeconds)),
  };
}

async function fetchAccessToken(forceRefresh = false): Promise<{
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
}> {
  const now = Date.now();
  if (!forceRefresh && accessTokenCache && accessTokenCache.expiresAt > now) {
    return {
      accessToken: accessTokenCache.accessToken,
      tokenType: accessTokenCache.tokenType,
      expiresInSeconds: Math.max(1, Math.floor((accessTokenCache.expiresAt - now) / 1000)),
    };
  }

  const config = resolveConfig();
  const url = withQuery(config.baseUrl, "/api/auth");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: config.grantType,
    }),
  });

  const rawText = await response.text();
  const parsed = safeJsonParse<KeepzDirectSettlementsAuthPayload>(rawText) ?? rawText;

  logger.debug("[Keepz Direct Settlements] Auth response", {
    status: response.status,
    ok: response.ok,
    path: "/api/auth",
  });

  if (!response.ok) {
    throw buildApiError(`Keepz auth failed (${response.status})`, {
      httpStatus: response.status,
      payload: parsed,
      path: "/api/auth",
      method: "POST",
    });
  }

  const tokenPayload = parseTokenPayload(parsed);
  const expiresAt = now + tokenPayload.expiresInSeconds * 1000 - TOKEN_EXPIRY_SKEW_MS;
  accessTokenCache = {
    accessToken: tokenPayload.accessToken,
    tokenType: tokenPayload.tokenType,
    expiresAt: Math.max(now + 10_000, expiresAt),
  };

  return tokenPayload;
}

async function requestWithAuth(
  options: KeepzDirectSettlementsRequestOptions,
  forceTokenRefresh = false,
): Promise<unknown> {
  const config = resolveConfig();
  const token = await fetchAccessToken(forceTokenRefresh);
  const url = withQuery(config.baseUrl, options.path, options.query);
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `${token.tokenType} ${token.accessToken}`,
  };

  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  logger.debug("[Keepz Direct Settlements] Request", {
    method: options.method,
    path: options.path,
    hasBody: body !== undefined,
    query: options.query ?? null,
  });

  const response = await fetch(url, {
    method: options.method,
    headers,
    body,
  });

  const rawText = await response.text();
  const parsed = safeJsonParse<Record<string, unknown>>(rawText) ?? rawText;
  logger.debug("[Keepz Direct Settlements] Response", {
    method: options.method,
    path: options.path,
    status: response.status,
    ok: response.ok,
    hasValuePayload: Boolean(asRecord(parsed)?.value),
  });

  if (response.status === 401 && !forceTokenRefresh) {
    return requestWithAuth(options, true);
  }

  if (!response.ok) {
    throw buildApiError(`Keepz request failed (${response.status})`, {
      httpStatus: response.status,
      payload: parsed,
      path: options.path,
      method: options.method,
    });
  }

  return parsed;
}

function requireNonEmptyString(value: string | undefined, label: string): string {
  const normalized = value?.trim() || "";
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function normalizeCreateTransactionPayload(
  input: KeepzDirectSettlementsCreateTransactionInput,
): Record<string, unknown> {
  const description = requireNonEmptyString(input.description, "description");
  const uniqueId = input.uniqueId?.trim() || crypto.randomUUID();
  if (!isUuidV4(uniqueId)) {
    throw new Error("uniqueId must be UUID v4");
  }

  const toIban = input.toIban?.trim();
  const receiverId = input.receiverId?.trim();
  const receiverType = input.receiverType;
  if (toIban && receiverId) {
    throw new Error("Provide either toIban or receiverId/receiverType, not both");
  }
  if (receiverId && !receiverType) {
    throw new Error("receiverType is required when receiverId is provided");
  }
  if (receiverType && !receiverId) {
    throw new Error("receiverId is required when receiverType is provided");
  }
  if (receiverId && !isUuidV4(receiverId)) {
    throw new Error("receiverId must be UUID v4");
  }
  if (!toIban && !receiverId) {
    throw new Error("Either toIban or receiverId/receiverType is required");
  }

  const payload: Record<string, unknown> = {
    amount: normalizeAmount(input.amount),
    currency: input.currency,
    description,
    uniqueId,
  };

  if (input.beneficiaryIdentityNumber?.trim()) {
    payload.beneficiaryIdentityNumber = input.beneficiaryIdentityNumber.trim();
  }
  if (input.beneficiaryName?.trim()) {
    payload.beneficiaryName = input.beneficiaryName.trim();
  }
  if (input.beneficiaryAddress?.trim()) {
    payload.beneficiaryAddress = input.beneficiaryAddress.trim();
  }
  if (toIban) {
    payload.toIban = toIban;
  }
  if (receiverId) {
    payload.receiverId = receiverId;
  }
  if (receiverType) {
    payload.receiverType = receiverType;
  }
  if (input.birthDate?.trim()) {
    payload.birthDate = input.birthDate.trim();
  }
  if (input.debtorName?.trim()) {
    payload.debtorName = input.debtorName.trim();
  }
  if (input.debtorIban?.trim()) {
    payload.debtorIban = input.debtorIban.trim();
  }
  if (input.debtorIdentityNumber?.trim()) {
    payload.debtorIdentityNumber = input.debtorIdentityNumber.trim();
  }

  return payload;
}

function extractPayloadValue(raw: unknown): Record<string, unknown> {
  const root = asRecord(raw);
  if (!root) {
    throw new Error("Keepz response is not an object");
  }
  const wrappedValue = asRecord(root.value);
  return wrappedValue ?? root;
}

export function clearKeepzDirectSettlementsTokenCache() {
  accessTokenCache = null;
}

export function isKeepzDirectSettlementsConfigured(): boolean {
  const clientId = env.KEEPZ_DIRECT_SETTLEMENTS_CLIENT_ID?.trim() || "";
  const clientSecret = env.KEEPZ_DIRECT_SETTLEMENTS_CLIENT_SECRET?.trim() || "";
  return Boolean(clientSecret && isUuidV4(clientId));
}

export function getKeepzDirectSettlementsDiagnostics() {
  const clientId = env.KEEPZ_DIRECT_SETTLEMENTS_CLIENT_ID?.trim() || "";
  const clientSecret = env.KEEPZ_DIRECT_SETTLEMENTS_CLIENT_SECRET?.trim() || "";
  const clientIdFormatValid = isUuidV4(clientId);
  return {
    baseUrl: env.KEEPZ_DIRECT_SETTLEMENTS_BASE_URL || DEFAULT_KEEPZ_DIRECT_SETTLEMENTS_BASE_URL,
    configured: Boolean(clientSecret && clientIdFormatValid),
    clientIdPresent: Boolean(clientId),
    clientIdFormatValid,
    clientSecretPresent: Boolean(clientSecret),
  };
}

export function getKeepzDirectSettlementsTokenDiagnostics() {
  const now = Date.now();
  return {
    cached: Boolean(accessTokenCache?.accessToken),
    expiresAt: accessTokenCache ? new Date(accessTokenCache.expiresAt).toISOString() : null,
    expiresInSeconds:
      accessTokenCache && accessTokenCache.expiresAt > now
        ? Math.floor((accessTokenCache.expiresAt - now) / 1000)
        : 0,
    tokenType: accessTokenCache?.tokenType ?? null,
  };
}

export async function getKeepzDirectSettlementsAccessToken(options?: { forceRefresh?: boolean }) {
  const token = await fetchAccessToken(Boolean(options?.forceRefresh));
  return {
    tokenType: token.tokenType,
    expiresInSeconds: token.expiresInSeconds,
  };
}

export async function createKeepzDirectSettlementsTransaction(
  input: KeepzDirectSettlementsCreateTransactionInput,
): Promise<KeepzDirectSettlementsCreateTransactionResult> {
  const payload = normalizeCreateTransactionPayload(input);
  const raw = await requestWithAuth({
    method: "POST",
    path: "/api/distributor",
    body: payload,
  });

  const value = extractPayloadValue(raw);
  const transactionId = asFiniteNumber(value.transactionId);
  const status = typeof value.status === "string" ? value.status : "";
  const payloadUniqueId = typeof payload.uniqueId === "string" ? payload.uniqueId : "";
  const uniqueId = typeof value.uniqueId === "string" && value.uniqueId ? value.uniqueId : payloadUniqueId;
  if (transactionId === null || !status || !uniqueId) {
    throw new Error("Keepz create transaction response is missing required fields");
  }

  return {
    transactionId,
    status,
    statusDescription:
      typeof value.statusDescription === "string" ? value.statusDescription : null,
    uniqueId,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    raw,
  };
}

export async function getKeepzDirectSettlementsTransactionDetails(
  transactionId: number,
): Promise<KeepzDirectSettlementsTransactionDetails> {
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error("transactionId must be a positive integer");
  }

  const raw = await requestWithAuth({
    method: "GET",
    path: "/api/distributor/details",
    query: {
      transaction_id: transactionId,
    },
  });

  const value = extractPayloadValue(raw);
  const parsedTransactionId = asFiniteNumber(value.transactionId);
  const status = typeof value.status === "string" ? value.status : "";
  if (parsedTransactionId === null || !status) {
    throw new Error("Keepz transaction details response is missing required fields");
  }

  return {
    transactionId: parsedTransactionId,
    status,
    statusDescription:
      typeof value.statusDescription === "string" ? value.statusDescription : null,
    amount: asFiniteNumber(value.amount),
    toIban: typeof value.toIban === "string" ? value.toIban : null,
    currency: typeof value.currency === "string" ? value.currency : null,
    paymentDescription:
      typeof value.paymentDescription === "string" ? value.paymentDescription : null,
    uniqueId: typeof value.uniqueId === "string" ? value.uniqueId : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    commissionAmount: asFiniteNumber(value.commissionAmount),
    raw,
  };
}

export async function getKeepzDirectSettlementsBalance(
  currency?: KeepzDirectSettlementsCurrency,
): Promise<KeepzDirectSettlementsBalanceResult> {
  const raw = await requestWithAuth({
    method: "GET",
    path: "/api/distributor/balance/check",
    query: {
      currency,
    },
  });

  const value = extractPayloadValue(raw);
  const amount = asFiniteNumber(value.amount);
  if (amount === null) {
    throw new Error("Keepz balance response is missing amount");
  }

  return {
    amount,
    currency: currency ?? null,
    raw,
  };
}
