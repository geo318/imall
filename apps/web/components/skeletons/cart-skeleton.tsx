import { uuid } from "@tanstack/react-form";

export function CartItemSkeleton() {
  return (
    <div className="flex gap-4 p-4 bg-white rounded-xl border border-slate-200 animate-pulse">
      <div className="w-24 h-24 rounded-lg bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="h-5 bg-slate-200 rounded w-1/4" />
      </div>
      <div className="flex flex-col items-end justify-between">
        <div className="h-4 bg-slate-200 rounded w-12" />
      </div>
    </div>
  );
}

export function CartSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, _i) => (
        <CartItemSkeleton key={uuid()} />
      ))}
    </div>
  );
}
