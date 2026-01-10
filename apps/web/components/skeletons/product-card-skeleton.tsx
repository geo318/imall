import { uuid } from "@tanstack/react-form";

export function ProductCardSkeleton() {
  return (
    <div className="group bg-white rounded-3xl border border-slate-200/50 overflow-hidden hover:shadow-lg transition-all duration-300 animate-pulse">
      <div className="aspect-square bg-slate-200 relative" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="h-6 bg-slate-200 rounded w-1/3" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: Readonly<{ count?: number }>) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {Array.from({ length: count }).map(() => (
        <ProductCardSkeleton key={uuid()} />
      ))}
    </div>
  );
}
