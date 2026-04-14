export const CHECKOUT_CART_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,80}$/;

export function sanitizeCheckoutCartKey(
  requestedCartKey: string | null | undefined,
  fallbackCartKey: string,
): string {
  if (!requestedCartKey) {
    return fallbackCartKey;
  }

  const candidate = requestedCartKey.trim();
  if (!candidate) {
    return fallbackCartKey;
  }

  return CHECKOUT_CART_KEY_PATTERN.test(candidate) ? candidate : fallbackCartKey;
}

export function stringifyCheckoutSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const urlSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        urlSearchParams.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      urlSearchParams.set(key, value);
    }
  }

  const queryString = urlSearchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export function buildCheckoutSignInRedirectPath(
  checkoutPath: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const redirectUrl = `${checkoutPath}${stringifyCheckoutSearchParams(searchParams)}`;
  return `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`;
}
