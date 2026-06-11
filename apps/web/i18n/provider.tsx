"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { createTranslator, type Translator } from "./translator";
import type { Dictionary } from "./types";

type I18nContextValue = {
  locale: Locale;
  messages: Dictionary;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Dictionary;
  children: React.ReactNode;
}) {
  // Stable object reference — only changes when locale or messages change (i.e. on locale switch).
  // Without this, every render of the layout would create a new context value and
  // force all useContext(I18nContext) consumers to rerender.
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslations(): Translator {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslations must be used within I18nProvider");
  }
  // Memoize per messages reference — createTranslator allocates closures on every call.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createTranslator(context.messages), [context.messages]);
}

export function useLocale() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useLocale must be used within I18nProvider");
  }
  return context.locale;
}
