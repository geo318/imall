import { auth } from "@clerk/nextjs/server";
import { CheckoutClient } from "@/components/checkout/checkout-client";
import { buildCheckoutSignInRedirectPath } from "@/components/checkout/checkout-routing";
import { defaultLocale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation.server";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutPage({ params, searchParams }: PageProps) {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  const { userId } = await auth();

  if (!userId) {
    const checkoutPath = locale === defaultLocale ? `/${slug}/checkout` : `/${locale}/${slug}/checkout`;
    return redirect(buildCheckoutSignInRedirectPath(checkoutPath, query));
  }

  return <CheckoutClient cartKey={`cart:${slug}`} continueShoppingHref={`/${slug}`} />;
}
