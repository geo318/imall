export const CHECKOUT_INSTALLMENT_CART_KEY_COOKIE = "checkout_installment_cart_key";
export const CHECKOUT_INSTALLMENT_CART_ID_COOKIE = "checkout_installment_cart_id";
export const CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE = "checkout_installment_order_code";
export const CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE = "checkout_installment_redirect_url";
export const CHECKOUT_INSTALLMENT_PROVIDER_COOKIE = "checkout_installment_provider";
export const CHECKOUT_INSTALLMENT_PAYMENT_TYPE_COOKIE = "checkout_installment_payment_type";

export type OnlineCheckoutProvider = "credo" | "keepz";
export type OnlineCheckoutPaymentType = "card" | "installments";

type LaunchUrlInput = {
  provider: OnlineCheckoutProvider;
  paymentType?: OnlineCheckoutPaymentType;
  cartId: string;
  cartKey: string;
  installmentLength?: number;
  clientFullName?: string;
  mobile?: string;
  email?: string;
  factAddress?: string;
  personalNumber?: string;
  isForeign?: boolean;
  returnTo?: string;
};

type CredoLaunchUrlInput = Omit<
  LaunchUrlInput,
  "provider" | "paymentType" | "personalNumber" | "isForeign"
> & {
  credoVariant?: "zero" | "standard";
};

type KeepzLaunchUrlInput = Omit<
  LaunchUrlInput,
  "provider" | "installmentLength" | "clientFullName" | "mobile" | "email" | "factAddress"
>;

function normalizeBankRedirectUrl(rawUrl: string, domain: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (
      (parsed.hostname !== domain && !parsed.hostname.endsWith(`.${domain}`)) ||
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.port
    )
      return "";
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function normalizeCredoRedirectUrl(rawUrl: string): string {
  return normalizeBankRedirectUrl(rawUrl, "credo.ge");
}

export function normalizeKeepzRedirectUrl(rawUrl: string): string {
  return normalizeBankRedirectUrl(rawUrl, "keepz.me");
}

export function normalizeCheckoutReturnPath(returnTo: string | null): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: reject URL characters that can change the redirect origin.
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//") || /[\\\u0000-\u0020]/.test(returnTo))
    return "/";
  return returnTo;
}

export function normalizeCredoMobile(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");
  if (digits.startsWith("995") && digits.length >= 12) {
    return digits.slice(3);
  }
  return digits;
}

export function normalizeKeepzPersonalNumber(rawValue: string): string {
  return rawValue.replace(/\D/g, "");
}

function buildInstallmentLaunchUrl({
  provider,
  paymentType = "installments",
  cartId,
  cartKey,
  installmentLength,
  clientFullName,
  mobile,
  email,
  factAddress,
  personalNumber,
  isForeign,
  returnTo,
}: LaunchUrlInput): string {
  const params = new URLSearchParams({
    cartId,
    cartKey,
    paymentType,
  });

  if (provider === "credo") {
    params.set("installmentLength", String(installmentLength ?? 12));
    if (clientFullName?.trim()) params.set("clientFullName", clientFullName.trim());
    if (mobile?.trim()) params.set("mobile", mobile.trim());
    if (email?.trim()) params.set("email", email.trim());
    if (factAddress?.trim()) params.set("factAddress", factAddress.trim());
  } else {
    if (personalNumber?.trim()) params.set("personalNumber", personalNumber.trim());
    if (typeof isForeign === "boolean") params.set("isForeign", String(isForeign));
  }

  if (returnTo?.trim()) params.set("returnTo", returnTo.trim());

  return `/api/checkout/installments/${provider}/launch?${params.toString()}`;
}

export function buildCredoLaunchUrl(input: CredoLaunchUrlInput): string {
  const { credoVariant, ...rest } = input;
  const base = buildInstallmentLaunchUrl({
    ...rest,
    provider: "credo",
    paymentType: "installments",
  });
  if (credoVariant === "standard") {
    return `${base}&credoVariant=standard`;
  }
  return base;
}

export function buildKeepzLaunchUrl(input: KeepzLaunchUrlInput): string {
  return buildInstallmentLaunchUrl({
    ...input,
    provider: "keepz",
  });
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

export function readPersistedInstallmentState(
  cartKey: string,
  cookieString?: string,
  cartId?: string | null,
) {
  if (!cookieString) {
    return null;
  }

  const parsed = parseCookieString(cookieString);
  const persistedCartKey = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_CART_KEY_COOKIE]);
  if (!persistedCartKey || persistedCartKey !== cartKey) {
    return null;
  }
  const persistedCartId = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_CART_ID_COOKIE]);
  if (cartId && persistedCartId && persistedCartId !== cartId) return null;

  const orderCode = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE]);
  const redirectUrl = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE]);
  const provider = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_PROVIDER_COOKIE]);
  const paymentType = decodeCookieValue(parsed[CHECKOUT_INSTALLMENT_PAYMENT_TYPE_COOKIE]);
  if (!orderCode) {
    return null;
  }

  const normalizedProvider: OnlineCheckoutProvider =
    provider === "credo" || provider === "keepz" ? provider : "credo";
  const normalizedPaymentType: OnlineCheckoutPaymentType =
    paymentType === "card" ? "card" : "installments";

  const normalizedRedirectUrl =
    normalizedProvider === "keepz"
      ? redirectUrl
        ? normalizeKeepzRedirectUrl(redirectUrl)
        : null
      : redirectUrl
        ? normalizeCredoRedirectUrl(redirectUrl)
        : null;

  return {
    cartKey: persistedCartKey,
    cartId: persistedCartId,
    orderCode,
    redirectUrl: normalizedRedirectUrl,
    provider: normalizedProvider,
    paymentType: normalizedPaymentType,
  };
}

export function clearPersistedInstallmentCookies() {
  if (typeof document === "undefined") {
    return;
  }

  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  for (const name of [
    CHECKOUT_INSTALLMENT_CART_KEY_COOKIE,
    CHECKOUT_INSTALLMENT_CART_ID_COOKIE,
    CHECKOUT_INSTALLMENT_ORDER_CODE_COOKIE,
    CHECKOUT_INSTALLMENT_REDIRECT_URL_COOKIE,
    CHECKOUT_INSTALLMENT_PROVIDER_COOKIE,
    CHECKOUT_INSTALLMENT_PAYMENT_TYPE_COOKIE,
  ]) {
    // biome-ignore lint/suspicious/noDocumentCookie: cookie-store is not consistently available in target mobile browsers.
    document.cookie = `${name}=; expires=${expires}; path=/; SameSite=Lax`;
  }
}
