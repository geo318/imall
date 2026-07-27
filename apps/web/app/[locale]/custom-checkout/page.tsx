import { env } from "@repo/shared";
import { notFound } from "next/navigation";
import { CustomCheckoutClient } from "@/components/custom-checkout/custom-checkout-client";

type CustomCheckoutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomCheckoutPage({ searchParams }: CustomCheckoutPageProps) {
  const query = await searchParams;
  const rawPass = query.pass;
  const pass = Array.isArray(rawPass) ? rawPass[0] : rawPass;

  const expectedPass = env.CUSTOM_CHECKOUT_PASS?.trim();
  // Wrong or missing pass is indistinguishable from a non-existent route.
  if (!expectedPass || !pass || pass !== expectedPass) {
    notFound();
  }

  return <CustomCheckoutClient pass={pass} />;
}
