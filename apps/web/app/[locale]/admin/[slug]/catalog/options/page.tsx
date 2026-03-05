import { VariantOptionsManager } from "../_components/variant-options-manager";

export default async function VariantOptionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <VariantOptionsManager shopSlug={(await params).slug} />;
}
