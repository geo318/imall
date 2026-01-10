import { env } from "@repo/shared";
import { isProductIdentifier, isReservedRoute } from "@/lib/utils";
import { ProductServer } from "./_components/product/product-server";
import { ShopProfileClient } from "./_components/shop/shop-profile-client";

// PPR: Dynamic route with conditional rendering based on slug type
export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Check if it's a reserved route name
  if (isReservedRoute(slug)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">404 - Page Not Found</h1>
          <p className="text-slate-600">The page you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Check if it's a product identifier (format: slug-abc12345)
  if (isProductIdentifier(slug)) {
    return <ProductServer productIdentifier={slug} />;
  }

  // Otherwise treat it as a shop slug
  const shopName = slug === env.SEED_SHOP_SLUG ? env.SEED_SHOP_NAME : slug;
  return <ShopProfileClient shopName={shopName} shopSlug={slug} />;
}
