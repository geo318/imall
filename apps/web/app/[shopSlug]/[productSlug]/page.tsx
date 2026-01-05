import { ProductClient } from "./ProductClient";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ shopSlug: string; productSlug: string }>;
}) {
  const { shopSlug, productSlug } = await params;
  return <ProductClient shopSlug={shopSlug} productSlug={productSlug} />;
}
