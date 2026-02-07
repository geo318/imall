import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect as nextRedirect } from "next/navigation";
import { defaultLocale, type Locale, locales, prefixLocalePath } from "./config";

export async function getCurrentLocale(): Promise<Locale> {
  const headerLocale = (await headers()).get("x-locale");
  if (headerLocale && locales.includes(headerLocale as Locale)) {
    return headerLocale as Locale;
  }
  const cookie = (await cookies()).get("NEXT_LOCALE")?.value;
  if (cookie && locales.includes(cookie as Locale)) return cookie as Locale;
  return defaultLocale;
}

export async function redirect(path: string) {
  const locale = await getCurrentLocale();
  return nextRedirect(prefixLocalePath(path, locale));
}

export async function LinkWithLocale({
  href,
  ...props
}: React.ComponentProps<typeof Link> & { href: string }) {
  const locale = await getCurrentLocale();

  return <Link href={prefixLocalePath(href, locale)} {...props} />;
}

export { LinkWithLocale as Link };
