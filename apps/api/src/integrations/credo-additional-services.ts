import { env } from "../context";

const DEFAULT_CREDO_ADDITIONAL_API_BASE_URL = "http://10.195.103.186:1414/api";
const TOKEN_TTL_MS = 55 * 60 * 1000;

type CredoAuthResponse = {
  data?: {
    token?: string | null;
    merchantId?: string | number | null;
  } | null;
  errorCode?: string | null;
  message?: string | null;
  state?: number | null;
};

type CredoMarkAsDeliveredResponse = {
  data?: {
    success?: boolean | null;
    msg?: string | null;
  } | null;
  errorCode?: string | null;
  message?: string | null;
  state?: number | null;
};

let authTokenCache: {
  token: string;
  merchantId: string;
  expiresAt: number;
} | null = null;

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getCredoAdditionalApiBaseUrl(): string {
  return normalizeBaseUrl(
    env.CREDO_ADDITIONAL_API_BASE_URL || DEFAULT_CREDO_ADDITIONAL_API_BASE_URL,
  );
}

function getCredoAdditionalCredentials(): { username: string; password: string } {
  const username = env.CREDO_ADDITIONAL_USERNAME?.trim();
  const password = env.CREDO_ADDITIONAL_PASSWORD?.trim();

  if (!username || !password) {
    throw new Error(
      "Credo additional-services credentials are not configured (CREDO_ADDITIONAL_USERNAME/CREDO_ADDITIONAL_PASSWORD)",
    );
  }

  return { username, password };
}

function normalizeMerchantId(rawMerchantId: string | number | null | undefined): string {
  const fromEnv = env.CREDO_MERCHANT_ID?.trim();
  if (fromEnv) return fromEnv;
  if (rawMerchantId === null || rawMerchantId === undefined) {
    throw new Error("Credo merchant id is missing");
  }

  const normalized = String(rawMerchantId).trim();
  if (!normalized) {
    throw new Error("Credo merchant id is empty");
  }
  return normalized;
}

async function authenticateCredoAdditionalServices(forceRefresh = false): Promise<{
  token: string;
  merchantId: string;
}> {
  const now = Date.now();
  if (!forceRefresh && authTokenCache && authTokenCache.expiresAt > now) {
    return {
      token: authTokenCache.token,
      merchantId: authTokenCache.merchantId,
    };
  }

  const { username, password } = getCredoAdditionalCredentials();
  const response = await fetch(`${getCredoAdditionalApiBaseUrl()}/User/Authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const rawText = await response.text();
  const payload = safeJsonParse<CredoAuthResponse>(rawText);

  if (!response.ok) {
    throw new Error(
      `Credo authenticate request failed (${response.status}): ${rawText || response.statusText}`,
    );
  }

  const token = payload?.data?.token?.trim();
  if (!token) {
    throw new Error("Credo authenticate request succeeded but token is missing");
  }

  const merchantId = normalizeMerchantId(payload?.data?.merchantId);
  authTokenCache = {
    token,
    merchantId,
    expiresAt: now + TOKEN_TTL_MS,
  };

  return { token, merchantId };
}

function buildMarkAsDeliveredBody(orderCode: string, merchantId: string) {
  const numericMerchantId = Number(merchantId);
  return {
    OrderCode: orderCode,
    MerchantId: Number.isFinite(numericMerchantId) ? numericMerchantId : merchantId,
  };
}

async function sendMarkAsDelivered(orderCode: string): Promise<CredoMarkAsDeliveredResponse> {
  const { token, merchantId } = await authenticateCredoAdditionalServices();
  const response = await fetch(`${getCredoAdditionalApiBaseUrl()}/Shop/MarkAsDelivered`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(buildMarkAsDeliveredBody(orderCode, merchantId)),
  });

  const rawText = await response.text();
  const payload = safeJsonParse<CredoMarkAsDeliveredResponse>(rawText);

  if (!response.ok) {
    throw new Error(
      `Credo MarkAsDelivered request failed (${response.status}): ${rawText || response.statusText}`,
    );
  }

  return payload ?? { data: { success: false, msg: "Invalid Credo response" } };
}

export async function markCredoInstallmentAsDelivered(orderCode: string): Promise<{
  success: boolean;
  message: string | null;
  raw: CredoMarkAsDeliveredResponse;
}> {
  const normalizedOrderCode = orderCode.trim();
  if (!normalizedOrderCode) {
    throw new Error("Order code is required to mark installment as delivered");
  }

  let payload = await sendMarkAsDelivered(normalizedOrderCode);
  if (payload?.state === 1) {
    // Token may expire early; retry once with fresh authentication.
    await authenticateCredoAdditionalServices(true);
    payload = await sendMarkAsDelivered(normalizedOrderCode);
  }

  const success = Boolean(payload?.data?.success);
  const message = payload?.data?.msg || payload?.message || null;
  if (!success) {
    throw new Error(message || "Credo MarkAsDelivered returned unsuccessful response");
  }

  return {
    success,
    message,
    raw: payload,
  };
}
