import type { MarketingProduct } from "@/components/marketing/product-card";
import type { ApiProduct } from "./api/products";
import { getProductIdentifier } from "./api/products";

export function mapApiProductToMarketing(product: ApiProduct): MarketingProduct {
  const firstVariant = product.variants?.[0];
  const shopSlug = product.tenantSlug ?? "shop";
  const shopName = product.tenantName ?? shopSlug;
  const productIdentifier = getProductIdentifier(product.id, product.slug);

  // Skip products with missing required data
  if (!product.id || !product.slug) {
    console.warn("Product missing id or slug:", product);
  }
  const auction = firstVariant?.auction ?? null;
  const isAuction = Boolean(auction) || Boolean(product.hasAuction);
  const currentBid = auction
    ? Number(auction.currentPrice ?? auction.startingBid ?? firstVariant?.price ?? 0)
    : undefined;
  // endsAt is passed to client component for dynamic calculation
  const endsAt = auction?.endsAt ?? undefined;
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    price: firstVariant ? Number(firstVariant.price) : null,
    currency: firstVariant?.currency ?? null,
    vendor: shopName,
    image: `https://picsum.photos/seed/${product.slug}/800/800`,
    href: `/${productIdentifier}`,
    isAuction,
    currentBid: isAuction && currentBid ? currentBid : undefined,
    endsAt: isAuction && endsAt ? endsAt : undefined,
  };
}
