"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { defaultLocale, type Locale, locales } from "@/i18n/config";
import { usePathname, useSearchParams } from "@/i18n/navigation.client";
import { cn } from "@/lib/utils";

const localeLabels: Record<Locale, string> = {
  en: "EN",
  ka: "KA",
  ru: "RU",
};

// Stable module-level pattern — never recreated on render.
const localePattern = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

export function LanguageSwitcher({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const match = pathname.match(localePattern);
  const current = (match?.[1] as Locale) ?? defaultLocale;

  // Track which locale the user clicked during a pending transition.
  // No useEffect needed — when isPending clears, current has already updated.
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  const selected = isPending && pendingLocale !== null ? pendingLocale : current;

  const withoutLocale = pathname.replace(localePattern, "") || "/";
  const basePath = withoutLocale.startsWith("/") ? withoutLocale : `/${withoutLocale}`;
  const query = searchParams.toString();
  const selectedIndex = useMemo(() => Math.max(0, locales.indexOf(selected)), [selected]);

  return (
    <div
      className={cn(
        "relative inline-grid grid-cols-3 rounded-full border border-slate-200 bg-white p-1 text-xs",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-full bg-emerald-600 shadow-sm transition-transform duration-300 ease-out"
        style={{
          width: "calc((100% - 0.5rem) / 3)",
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {locales.map((locale) => {
        const href = basePath === "/" ? `/${locale}` : `/${locale}${basePath}`;
        const fullHref = query ? `${href}?${query}` : href;
        const isActive = locale === current;
        const isSelected = locale === selected;
        return (
          <button
            key={locale}
            type="button"
            className={cn(
              "relative z-10 rounded-full px-2 py-1 font-semibold transition-colors duration-200",
              isSelected ? "text-white" : "text-slate-600 hover:text-slate-900",
            )}
            aria-current={isActive ? "page" : undefined}
            disabled={isPending || isSelected}
            onClick={() => {
              if (isSelected) return;
              setPendingLocale(locale);
              startTransition(() => {
                router.replace(fullHref, { scroll: false });
              });
            }}
          >
            {localeLabels[locale]}
          </button>
        );
      })}
    </div>
  );
}
