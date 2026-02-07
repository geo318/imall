import type { Dictionary } from "./types";
import { defaultLocale, type Locale } from "./config";

const dictionaries = {
  en: () => import("../messages/en.json").then((mod) => mod.default as Dictionary),
  ka: () => import("../messages/ka.json").then((mod) => mod.default as Dictionary),
  ru: () => import("../messages/ru.json").then((mod) => mod.default as Dictionary),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loader = dictionaries[locale] ?? dictionaries[defaultLocale];
  return loader();
}
