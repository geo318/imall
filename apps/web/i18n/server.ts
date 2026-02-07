import type { Locale } from "./config";
import { getDictionary } from "./dictionaries";
import { createTranslator, type Translator } from "./translator";

export async function getTranslations(locale: Locale): Promise<Translator> {
  const messages = await getDictionary(locale);
  return createTranslator(messages);
}
