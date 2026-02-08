"use client";

import Link from "next/link";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { usePathname, useSearchParams } from "@/i18n/navigation.client";
import { cn } from "@/lib/utils";

const localeLabels: Record<Locale, string> = {
  en: "EN",
  ka: "KA",
  ru: "RU",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const localePattern = new RegExp(`^/(${locales.join("|")})(?=/|$)`);
  const match = pathname.match(localePattern);
  const current = (match?.[1] as Locale) ?? defaultLocale;
  const withoutLocale = pathname.replace(localePattern, "") || "/";
  const basePath = withoutLocale.startsWith("/") ? withoutLocale : `/${withoutLocale}`;
  const query = searchParams.toString();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-xs",
        className,
      )}
    >
      {locales.map((locale) => {
        const href = basePath === "/" ? `/${locale}` : `/${locale}${basePath}`;
        const fullHref = query ? `${href}?${query}` : href;
        const isActive = locale === current;
        return (
          <Link
            key={locale}
            href={fullHref}
            className={cn(
              "rounded-full px-2 py-1 font-semibold transition",
              isActive
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {localeLabels[locale]}
          </Link>
        );
      })}
    </div>
  );
}
