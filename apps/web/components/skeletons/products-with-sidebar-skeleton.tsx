import { ProductCardSkeleton } from "./product-card-skeleton";

type Props = {
  count?: number;
  gridClassName?: string;
};

export function ProductsWithSidebarSkeleton({ count = 12, gridClassName }: Props) {
  const gridClasses = gridClassName ?? "grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3";

  return (
    <div className="space-y-8">
      <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200" />

      <div className="flex gap-8">
        <aside className="hidden w-64 shrink-0 space-y-4 md:block">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-slate-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-44 w-full animate-pulse rounded-xl bg-slate-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-slate-200" />
        </aside>

        <div className="flex-1">
          <div className="mb-6 h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className={gridClasses}>
            {Array.from({ length: count }).map((_, index) => (
              <ProductCardSkeleton key={`products-skeleton-${index}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
