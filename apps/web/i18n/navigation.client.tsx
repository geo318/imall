"use client";

import Link from "next/link";
import { useRouter as useNextRouter } from "next/navigation";
import { useLocale } from "./provider";
import { prefixLocalePath, type Locale } from "./config";

export function LinkWithLocale({
  href,
  ...props
}: React.ComponentProps<typeof Link> & { href: string }) {
  const locale = useLocale();
  return <Link href={prefixLocalePath(href, locale)} {...props} />;
}

export { LinkWithLocale as Link };
export { usePathname, useSearchParams } from "next/navigation";

export function useRouter() {
  const router = useNextRouter();
  const locale = useLocale();

  const prefix = (href: string) => prefixLocalePath(href, locale);

  return {
    ...router,
    push: (href: string, options?: Parameters<typeof router.push>[1]) =>
      router.push(prefix(href), options),
    replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
      router.replace(prefix(href), options),
    prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) =>
      router.prefetch(prefix(href), options),
  };
}
