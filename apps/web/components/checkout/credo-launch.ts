export const CHECKOUT_INSTALLMENT_CART_KEY_COOKIE = "checkout_installment_cart_key";
export const CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE = "checkout_installment_order_code";
export const CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE = "checkout_installment_redirect_url";

export type CredoLaunchMode =
  | "server-assign"
  | "server-replace"
  | "server-new-tab"
  | "server-popup"
  | "direct-replace";

type CredoLaunchUrlInput = {
  cartId: string;
  cartKey: string;
  installmentLength?: number;
  clientFullName?: string;
  mobile?: string;
  email?: string;
  factAddress?: string;
  returnTo?: string;
};

export function normalizeCredoRedirectUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.endsWith("credo.ge") && parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function normalizeCredoMobile(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  if (digits.startsWith("995") && digits.length >= 12) {
    return digits.slice(3);
  }
  return digits;
}

export function buildCredoLaunchUrl({
  cartId,
  cartKey,
  installmentLength = 12,
  clientFullName,
  mobile,
  email,
  factAddress,
  returnTo,
}: CredoLaunchUrlInput): string {
  const params = new URLSearchParams({
    cartId,
    cartKey,
    installmentLength: String(installmentLength),
  });

  if (clientFullName?.trim()) params.set("clientFullName", clientFullName.trim());
  if (mobile?.trim()) params.set("mobile", mobile.trim());
  if (email?.trim()) params.set("email", email.trim());
  if (factAddress?.trim()) params.set("factAddress", factAddress.trim());
  if (returnTo?.trim()) params.set("returnTo", returnTo.trim());

  return `/api/checkout/installments/credo/launch?${params.toString()}`;
}

function parseCookieString(cookieString: string) {
  return cookieString
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = entry.slice(0, separatorIndex);
      const value = entry.slice(separatorIndex + 1);
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function decodeCookieValue(value?: string) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function readPersistedInstallmentState(cartKey: string, cookieString?: string) {
  if (!cookieString) {
    return null;
  }

  const parsed = parseCookieString(cookieString);
  const persistedCartKey = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_CART_KEY_COOKIE]);
  if (!persistedCartKey || persistedCartKey !== cartKey) {
    return null;
  }

  const orderCode = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE]);
  const redirectUrl = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE]);
  if (!orderCode) {
    return null;
  }

  return {
    cartKey: persistedCartKey,
    orderCode,
    redirectUrl: redirectUrl ? normalizeCredoRedirectUrl(redirectUrl) : null,
  };
}

export function clearPersistedInstallmentCookies() {
  if (typeof document === "undefined") {
    return;
  }

  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  for (const name of [
    CHECKOUT_INSTALLMENT_CART_KEY_COOKIE,
    CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE,
    CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE,
  ]) {
    // biome-ignore lint/suspicious/noDocumentCookie: cookie-store is not consistently available in target mobile browsers.
    document.cookie = `${name}=; expires=${expires}; path=/; SameSite=Lax`;
  }
}
