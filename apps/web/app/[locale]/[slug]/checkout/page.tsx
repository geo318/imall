import { CheckoutClient } from "@/components/checkout/checkout-client";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CheckoutPage({ params }: PageProps) {
  const { slug } = await params;

  return <CheckoutClient cartKey={`cart:${slug}`} continueShoppingHref={`/${slug}`} />;
}
