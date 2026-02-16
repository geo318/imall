import { env } from "@repo/shared";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getShopProfile } from "@/app/actions/shops";
import { isProductIdentifier, isReservedRoute } from "@/lib/utils";
import { ProductServer } from "./_components/product/product-server";
import { ShopProfileClient } from "./_components/shop/shop-profile-client";

// PPR: Dynamic route with conditional rendering based on slug type
export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Check if it's a reserved route name
  if (isReservedRoute(slug)) {
    notFound();
  }

  // Check if it's a product identifier (format: slug-abc12345)
  if (isProductIdentifier(slug)) {
    return <ProductServer productIdentifier={slug} />;
  }

  // Otherwise treat it as a shop slug
  const profile = await getShopProfile(slug);
  const shopName = profile?.name ?? (slug === env.SEED_SHOP_SLUG ? env.SEED_SHOP_NAME : slug);
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ShopProfileClient
        shopName={shopName}
        shopSlug={slug}
        sellerEmail={profile?.sellerEmail ?? null}
        sellerPhone={profile?.sellerPhone ?? null}
        sellerRules={profile?.sellerRules ?? null}
      />
    </Suspense>
  );
}
