import { uuid } from "@tanstack/react-form";

export function ShopCardSkeleton() {
  return (
    <div className="group bg-white rounded-3xl border border-slate-200/50 p-6 animate-pulse">
      <div className="flex items-start gap-4 mb-4">
        <div className="h-16 w-16 rounded-2xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
      <div className="h-8 bg-slate-200 rounded w-1/4" />
    </div>
  );
}

export function ShopGridSkeleton({ count = 8 }: Readonly<{ count?: number }>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, _i) => (
        <ShopCardSkeleton key={uuid()} />
      ))}
    </div>
  );
}
