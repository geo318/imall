import { auth } from "@clerk/nextjs/server";
import { CheckoutClient } from "@/components/checkout/checkout-client";
import { buildCheckoutSignInRedirectPath } from "@/components/checkout/checkout-routing";
import { defaultLocale } from "@/i18n/config";
import { redirect } from "@/i18n/navigation.server";

type CheckoutPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutPage({ params, searchParams }: CheckoutPageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const { userId } = await auth();

  if (!userId) {
    const checkoutPath = locale === defaultLocale ? "/checkout" : `/${locale}/checkout`;
    return redirect(buildCheckoutSignInRedirectPath(checkoutPath, query));
  }

  return <CheckoutClient cartKey="cart" continueShoppingHref="/" />;
}
