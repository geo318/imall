import { Metadata } from "next";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000";

type InventoryEntry = {
  variantId: string;
  sku: string | null;
  price: string;
  currency: string;
  available: number;
};

async function fetchInventory(slug: string): Promise<InventoryEntry[]> {
  const response = await fetch(`${DOMAIN}/api/admin/${slug}/inventory`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load inventory");
  }
  return response.json();
}

export const metadata: Metadata = {
  title: "Inventory",
};

export default async function InventoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const inventory = await fetchInventory(slug);

  return (
    <div className="container py-10 space-y-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Inventory</p>
        <h1 className="text-3xl font-bold">Stock overview</h1>
        <p className="text-sm text-muted-foreground">
          Monitor variant availability alongside catalog changes.
        </p>
      </div>

      {inventory.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No inventory data available yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {inventory.map((item) => (
            <div
              key={item.variantId}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Variant SKU</p>
                <p className="text-sm text-muted-foreground">{item.variantId.slice(0, 8)}</p>
              </div>
              <h2 className="text-lg font-bold">
                {item.sku ?? "Default variant"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Available stock: <span className="font-semibold">{item.available}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Price: <span className="font-semibold">${Number(item.price).toFixed(2)} {item.currency}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
