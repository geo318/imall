import { uuid } from "@tanstack/react-form";

export function ProductDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="container py-8 md:py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square bg-slate-200 rounded-xl" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map(() => (
                <div key={uuid()} className="aspect-square bg-slate-200 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="h-8 bg-slate-200 rounded w-3/4" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
            <div className="h-10 bg-slate-200 rounded w-1/4" />
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-3/4" />
            </div>
            <div className="h-12 bg-slate-200 rounded w-full" />
            <div className="h-12 bg-slate-200 rounded w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
