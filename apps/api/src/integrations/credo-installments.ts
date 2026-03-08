import { createHash, randomBytes } from "node:crypto";
import { env } from "../context";

const DEFAULT_CREDO_ORDER_URL = "https://ganvadeba.credo.ge/widget_api/order.php";
const DEFAULT_CREDO_STATUS_URL = "https://ganvadeba.credo.ge/widget/api.php";
const ORDER_CODE_PREFIX = "IML";
const ORDER_CODE_MAX_LENGTH = 50;

export type CredoInstallmentProduct = {
  id: string;
  title: string;
  amount: number;
  price: number;
  type: 0;
};

export type StartCredoInstallmentInput = {
  cartId: string;
  products: CredoInstallmentProduct[];
  installmentLength?: number;
  clientFullName?: string;
  mobile?: string;
  email?: string;
  factAddress?: string;
};

export type CredoInstallmentStatusResult = {
  statusId: number | null;
  statusName: string;
  raw: unknown;
};

const CREDO_STATUS_NAMES: Record<number, string> = {
  2: "SENT",
  3: "APPROVED",
  4: "LATEST_APPROVED",
  5: "CLOSED_SUCCESSFULLY",
  6: "REJECTED",
  7: "CANCELED",
  9: "SENT_TO_BRANCH",
  10: "NEED_IDENTIFICATION",
  11: "DRAFT",
  12: "DOCUMENT_ASSIGNED",
  13: "SENT_TO_VIDEO_MONITORING",
  14: "SENT_TO_BACK_OFFICE_2",
};

function md5(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function normalizeText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asFiniteNumber(value: unknown): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(num) ? num : null;
}

function getCredoMerchantId(): string {
  if (!env.CREDO_MERCHANT_ID) {
    throw new Error("CREDO_MERCHANT_ID is not configured");
  }

  return String(env.CREDO_MERCHANT_ID).trim();
}

function getCredoSecret(): string {
  if (!env.CREDO_SHARED_SECRET) {
    throw new Error("CREDO_SHARED_SECRET is not configured");
  }

  return env.CREDO_SHARED_SECRET;
}

function getOrderUrl(): string {
  return env.CREDO_WIDGET_ORDER_URL || DEFAULT_CREDO_ORDER_URL;
}

function getStatusUrl(): string {
  return env.CREDO_WIDGET_STATUS_URL || DEFAULT_CREDO_STATUS_URL;
}

function buildOrderCode(cartId: string, secret: string): string {
  const compactCartId = cartId.replaceAll("-", "");
  const cartPart = compactCartId.slice(0, 8);
  const timestampPart = Date.now().toString(36);
  const noncePart = randomBytes(3).toString("hex");
  const signature = md5(`${cartId}:${timestampPart}:${noncePart}:${secret}`).slice(0, 10);
  const result = `${ORDER_CODE_PREFIX}-${cartPart}-${timestampPart}-${noncePart}-${signature}`;
  return result.slice(0, ORDER_CODE_MAX_LENGTH);
}

function parseOrderCode(orderCode: string): {
  cartPart: string;
  timestampPart: string;
  noncePart: string;
  signature: string;
} | null {
  const [prefix, cartPart, timestampPart, noncePart, signature] = orderCode.split("-");
  if (prefix !== ORDER_CODE_PREFIX || !cartPart || !timestampPart || !noncePart || !signature) {
    return null;
  }

  return { cartPart, timestampPart, noncePart, signature };
}

export function validateOrderCodeForCart(orderCode: string, cartId: string): boolean {
  const parsed = parseOrderCode(orderCode);
  if (!parsed) return false;

  const compactCartId = cartId.replaceAll("-", "");
  if (!compactCartId.startsWith(parsed.cartPart)) {
    return false;
  }

  const secret = getCredoSecret();
  const expectedSignature = md5(
    `${cartId}:${parsed.timestampPart}:${parsed.noncePart}:${secret}`,
  ).slice(0, 10);
  return expectedSignature === parsed.signature;
}

function buildCheckHash(products: CredoInstallmentProduct[], secret: string): string {
  const productString = products
    .map(
      (product) => `${product.id}${product.title}${product.amount}${product.price}${product.type}`,
    )
    .join("");
  return md5(`${productString}${secret}`);
}

function pickRedirectUrl(responseBody: unknown, response: Response): string | null {
  const body = (responseBody && typeof responseBody === "object" ? responseBody : null) as {
    data?: unknown;
    url?: unknown;
    URL?: unknown;
    redirectUrl?: unknown;
  } | null;
  const data = (body?.data && typeof body.data === "object" ? body.data : null) as {
    url?: unknown;
    URL?: unknown;
    redirectUrl?: unknown;
  } | null;

  const candidates = [
    typeof data?.URL === "string" ? data.URL : null,
    typeof data?.url === "string" ? data.url : null,
    typeof data?.redirectUrl === "string" ? data.redirectUrl : null,
    typeof body?.URL === "string" ? body.URL : null,
    typeof body?.url === "string" ? body.url : null,
    typeof body?.redirectUrl === "string" ? body.redirectUrl : null,
    response.headers.get("location"),
    response.headers.get("Location"),
  ];

  const firstValid = candidates.find((candidate) => {
    if (!candidate) return false;
    try {
      new URL(candidate);
      return true;
    } catch {
      return false;
    }
  });

  return firstValid ?? null;
}

export async function createCredoInstallmentApplication(
  input: StartCredoInstallmentInput,
): Promise<{
  orderCode: string;
  redirectUrl: string;
}> {
  const merchantId = getCredoMerchantId();
  const secret = getCredoSecret();
  const orderCode = buildOrderCode(input.cartId, secret);

  const products = input.products.map((product) => ({
    id: normalizeText(product.id, 64),
    title: normalizeText(product.title, 160),
    amount: Math.max(1, Math.floor(product.amount)),
    price: Math.max(1, Math.floor(product.price)),
    type: 0 as const,
  }));

  if (products.length === 0) {
    throw new Error("Cannot create installment application for empty products list");
  }

  const payload: Record<string, unknown> = {
    merchantId,
    orderCode,
    check: buildCheckHash(products, secret),
    products,
  };

  const installmentLength =
    typeof input.installmentLength === "number"
      ? Math.floor(input.installmentLength)
      : env.CREDO_INSTALLMENT_DEFAULT_MONTHS;
  if (installmentLength > 0) {
    payload.installmentLength = installmentLength;
  }

  if (input.clientFullName?.trim())
    payload.clientFullName = normalizeText(input.clientFullName, 128);
  if (input.mobile?.trim()) payload.mobile = normalizeText(input.mobile, 32);
  if (input.email?.trim()) payload.email = normalizeText(input.email, 256);
  if (input.factAddress?.trim()) payload.factAddress = normalizeText(input.factAddress, 256);

  const response = await fetch(getOrderUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  const parsedBody = rawText ? safeJsonParse(rawText) : null;

  if (!response.ok) {
    throw new Error(
      `Credo installment request failed (${response.status}): ${rawText || response.statusText}`,
    );
  }

  const redirectUrl = pickRedirectUrl(parsedBody, response);
  if (!redirectUrl) {
    throw new Error("Credo installment request succeeded but redirect URL is missing");
  }

  return { orderCode, redirectUrl };
}

export async function fetchCredoInstallmentStatus(
  orderCode: string,
): Promise<CredoInstallmentStatusResult> {
  const merchantId = getCredoMerchantId();
  const secret = getCredoSecret();
  const hash = md5(`${merchantId}${orderCode}${secret}`);
  const url = new URL(getStatusUrl());
  url.searchParams.set("merchantId", merchantId);
  url.searchParams.set("orderCode", orderCode);
  url.searchParams.set("hash", hash);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const rawText = await response.text();
  const parsed = rawText ? safeJsonParse(rawText) : null;

  if (!response.ok) {
    const body = (parsed && typeof parsed === "object" ? parsed : {}) as {
      data?: unknown;
      message?: unknown;
      status?: unknown;
    };
    const statusId = asFiniteNumber(body.data);
    const message = typeof body.message === "string" ? body.message : "";

    // Credo commonly returns 4xx for "no data"/"invalid request" in payload shape.
    // Treat these as non-fatal statuses so checkout page can show state instead of hard error.
    if (message) {
      return {
        statusId,
        statusName: message.toUpperCase().replace(/\s+/g, "_"),
        raw: parsed ?? rawText,
      };
    }

    throw new Error(
      `Credo status request failed (${response.status}): ${rawText || response.statusText}`,
    );
  }

  const body = (parsed && typeof parsed === "object" ? parsed : {}) as {
    data?: unknown;
    message?: unknown;
  };

  const statusId = asFiniteNumber(body.data);
  const statusName =
    (statusId ? CREDO_STATUS_NAMES[statusId] : null) ||
    (typeof body.message === "string" ? body.message : "UNKNOWN");

  return {
    statusId,
    statusName,
    raw: parsed ?? rawText,
  };
}

export function isInstallmentCheckoutReadyStatus(statusId: number | null): boolean {
  return statusId === 12 || statusId === 5;
}
