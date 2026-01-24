import { CatalogClient } from "./_components/catalog-client";

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  return <CatalogClient slug={(await params).slug} />;
}
