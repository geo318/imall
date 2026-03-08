type CheckoutSkeletonProps = {
  label: string;
};

export function CheckoutSkeleton({ label }: CheckoutSkeletonProps) {
  return (
    <div className="bg-slate-50" aria-busy="true" aria-live="polite" aria-label={label}>
      <div className="container py-8 md:py-12 animate-pulse">
        <div className="mb-6 h-4 w-36 rounded bg-slate-200" />

        <div className="mb-6 h-24 w-full rounded-xl border border-slate-200 bg-white" />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200" />
                <div className="h-1 flex-1 rounded bg-slate-200" />
                <div className="h-10 w-10 rounded-full bg-slate-200" />
              </div>

              <div className="space-y-4">
                <div className="h-5 w-56 rounded bg-slate-200" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-3 w-20 rounded bg-slate-200" />
                      <div className="h-11 w-full rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <div className="h-11 w-full rounded bg-slate-200 sm:w-44" />
                <div className="h-11 flex-1 rounded bg-slate-200" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <div className="h-3 w-28 rounded bg-slate-200" />
                    <div className="h-3 w-16 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-4 w-20 rounded bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
