export const DEFAULT_CURRENCY_CODE = "GEL";

const SYMBOL_BY_CURRENCY: Record<string, string> = {
  GEL: "₾",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function normalizeCurrencyCode(currency?: string | null): string {
  // Currency is fixed to GEL across storefront/admin for now.
  // Keep input ignored so legacy USD records still render as GEL.
  void currency;
  return DEFAULT_CURRENCY_CODE;
}

export function currencySymbol(currency?: string | null): string {
  const code = normalizeCurrencyCode(currency);
  return SYMBOL_BY_CURRENCY[code] ?? `${code} `;
}

export function formatCurrencyAmount(
  amount: number | string | null | undefined,
  currency?: string | null,
): string {
  const parsed =
    typeof amount === "number" ? amount : typeof amount === "string" ? Number(amount) : 0;
  const safeAmount = Number.isFinite(parsed) ? parsed : 0;
  return `${currencySymbol(currency)}${safeAmount.toFixed(2)}`;
}
