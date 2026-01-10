import type { MarketingProduct } from "@/components/marketing/product-card";
import type { ApiProduct } from "./api/products";
import { getProductIdentifier } from "./api/products";

function formatEndsIn(endsAtIso: string): string | null {
  const endsAt = new Date(endsAtIso).getTime();
  if (!Number.isFinite(endsAt)) return null;
  const diffMs = endsAt - Date.now();
  if (diffMs <= 0) return "soon";
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function mapApiProductToMarketing(product: ApiProduct): MarketingProduct {
  const firstVariant = product.variants?.[0];
  const shopSlug = product.tenantSlug ?? "shop";
  const shopName = product.tenantName ?? shopSlug;
  const productIdentifier = getProductIdentifier(product.id, product.slug);
  const auction = firstVariant?.auction ?? null;
  const isAuction = Boolean(auction) || Boolean(product.hasAuction);
  const currentBid = auction
    ? Number(auction.currentPrice ?? auction.startingBid ?? firstVariant?.price ?? 0)
    : undefined;
  const endsIn = auction?.endsAt ? formatEndsIn(auction.endsAt) ?? undefined : undefined;
  return {
    id: product.id,
    title: product.title,
    price: firstVariant ? Number(firstVariant.price) : null,
    currency: firstVariant?.currency ?? null,
    vendor: shopName,
    image: `https://picsum.photos/seed/${product.slug}/800/800`,
    href: `/${productIdentifier}`,
    isAuction,
    currentBid: isAuction && currentBid ? currentBid : undefined,
    endsIn: isAuction && endsIn ? endsIn : undefined,
  };
}
