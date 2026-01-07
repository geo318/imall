import { ProductClient } from "./ProductClient";
import { ShopProfileClient } from "./ShopProfileClient";
import { env } from "@repo/shared";

// Reserved route names that should not be treated as shop slugs
const RESERVED_ROUTES = ["cart", "checkout", "admin", "api", "products", "vendors", "about", "faq"];

// Helper to check if a slug is a product identifier (contains 8-char short ID at the end)
function isProductIdentifier(slug: string): boolean {
  const parts = slug.split("-");
  if (parts.length < 2) return false;
  const lastPart = parts.at(-1);
  return lastPart?.length === 8 && /^[a-f0-9]{8}$/i.test(lastPart);
}

export default async function SlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Check if it's a reserved route name
  if (RESERVED_ROUTES.includes(slug.toLowerCase())) {
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
    return <ProductClient productIdentifier={slug} />;
  }

  // Otherwise treat it as a shop slug
  const shopName = slug === env.SEED_SHOP_SLUG ? env.SEED_SHOP_NAME : slug;
  return <ShopProfileClient shopName={shopName} shopSlug={slug} />;
}
