import type { MarketingProduct } from "@/components/marketing/product-card";
import type { ApiProduct } from "./api/products";

export function mapApiProductToMarketing(product: ApiProduct): MarketingProduct {
  const firstVariant = product.variants?.[0];
  const shopSlug = product.tenantSlug ?? "shop";
  const shopName = product.tenantName ?? shopSlug;
  return {
    id: product.id,
    title: product.title,
    price: firstVariant ? Number(firstVariant.price) : null,
    currency: firstVariant?.currency ?? null,
    vendor: shopName,
    image: `https://picsum.photos/seed/${product.slug}/800/800`,
    href: `/${shopSlug}/${product.slug}`,
  };
}
