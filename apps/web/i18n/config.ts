export const locales = ["en", "ka", "ru"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ka";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function prefixLocalePath(path: string, locale: Locale) {
  if (!path.startsWith("/")) return path;
  const segments = path.split("/").filter(Boolean);
  const first = segments[0];
  if (first && isLocale(first)) return path;
  return locale === defaultLocale ? path : `/${locale}${path}`;
}
