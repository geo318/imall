import { env } from "@repo/shared";
import { ShopProfileClient } from "./ShopProfileClient";

export default function ShopPage({
  params,
}: {
  params: { shopSlug: string };
}) {
  const { shopSlug } = params;
  const shopName = shopSlug === env.SEED_SHOP_SLUG ? env.SEED_SHOP_NAME : shopSlug;

  return <ShopProfileClient shopName={shopName} shopSlug={shopSlug} />;
}
