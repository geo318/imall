import { uuid } from "@tanstack/react-form";

export function ProductDetailSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Image Gallery Skeleton */}
      <div className="aspect-square bg-slate-200 rounded-xl mb-4" />
      <div className="grid grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, _i) => (
          <div key={uuid()} className="aspect-square bg-slate-200 rounded-lg" />
        ))}
      </div>

      {/* Product Info Skeleton */}
      <div className="space-y-4">
        <div className="h-8 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
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
  );
}

export function ProductPriceSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-slate-200 rounded w-1/3 mb-4" />
      <div className="h-6 bg-slate-200 rounded w-1/4" />
    </div>
  );
}

export function ProductAvailabilitySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-6 bg-slate-200 rounded w-1/2 mb-2" />
      <div className="h-4 bg-slate-200 rounded w-full mb-2" />
      <div className="h-4 bg-slate-200 rounded w-2/3" />
    </div>
  );
}

export function ProductActionsSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-12 bg-slate-200 rounded w-full" />
      <div className="h-12 bg-slate-200 rounded w-full" />
      <div className="h-10 bg-slate-200 rounded w-full" />
    </div>
  );
}

// Granular skeletons for auction section
export function AuctionTimerSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-3 p-4 rounded-xl bg-warning/10">
      <div className="h-5 w-5 bg-slate-200 rounded" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-24" />
        <div className="h-6 bg-slate-200 rounded w-32" />
      </div>
    </div>
  );
}

export function AuctionBidInfoSkeleton() {
  return (
    <div className="animate-pulse grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded w-20" />
        <div className="h-8 bg-slate-200 rounded w-24" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded w-20" />
        <div className="h-8 bg-slate-200 rounded w-16" />
      </div>
    </div>
  );
}

export function AuctionFormSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 h-12 bg-slate-200 rounded" />
        <div className="h-12 w-32 bg-slate-200 rounded" />
      </div>
      <div className="h-4 bg-slate-200 rounded w-32 mx-auto" />
    </div>
  );
}

export function AuctionCardSkeleton() {
  return (
    <div className="animate-pulse p-6 rounded-2xl border border-border bg-card space-y-4">
      <AuctionTimerSkeleton />
      <div className="h-20 bg-slate-200 rounded-lg" />
      <AuctionBidInfoSkeleton />
      <AuctionFormSkeleton />
    </div>
  );
}
