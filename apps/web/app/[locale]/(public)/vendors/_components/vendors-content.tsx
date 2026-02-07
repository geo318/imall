import { ShopGridSkeleton } from "@/components/skeletons/shop-skeleton";
import { getShopsServer } from "@/lib/server/shops";
import { ShopCard } from "./shop-card";

export async function VendorsContent() {
  const shops = await getShopsServer(50);

  if (shops.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <p className="text-2xl">🏪</p>
        </div>
        <h3 className="text-lg font-semibold mb-2">No vendors found</h3>
        <p className="text-slate-600">Check back later for new vendors.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {shops.map((shop) => (
        <ShopCard key={shop.id} shop={shop} />
      ))}
    </div>
  );
}

export function VendorsContentSkeleton() {
  return <ShopGridSkeleton count={8} />;
}
