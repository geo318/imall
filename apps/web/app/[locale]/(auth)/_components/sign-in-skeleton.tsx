export function SignInSkeleton() {
  return (
    <div className="space-y-6">
      {/* OAuth Button Skeleton */}
      <div className="flex gap-3">
        <div className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
      </div>

      {/* Divider Skeleton */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="h-3 w-32 rounded bg-slate-200" />
        </div>
      </div>

      {/* Email Input Skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
        <div className="h-11 w-full rounded-lg bg-slate-100 border border-slate-200 animate-pulse" />
      </div>

      {/* Continue Button Skeleton */}
      <div className="h-11 w-full rounded-lg bg-slate-200 animate-pulse" />

      {/* Sign Up Link Skeleton */}
      <div className="flex justify-center">
        <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
      </div>
    </div>
  );
}
