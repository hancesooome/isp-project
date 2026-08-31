interface PageSkeletonProps {
  count?: number
  type?: 'cards' | 'list' | 'detail'
}

export function PageSkeleton({
  count = 3,
  type = 'cards',
}: PageSkeletonProps) {
  return (
    <div
      aria-label="Loading page content"
      aria-busy="true"
      className="w-full space-y-4"
      role="status"
    >
      <span className="sr-only">Loading content, please wait...</span>

      {type === 'cards' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }).map((_, index) => (
            <div
              className="h-48 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-6 motion-reduce:animate-none"
              key={index}
            >
              <div className="h-4 w-1/3 rounded bg-slate-800" />
              <div className="mt-4 h-6 w-2/3 rounded bg-slate-800" />
              <div className="mt-6 h-4 w-full rounded bg-slate-800" />
              <div className="mt-2 h-4 w-4/5 rounded bg-slate-800" />
            </div>
          ))}
        </div>
      )}

      {type === 'list' && (
        <div className="space-y-4">
          {Array.from({ length: count }).map((_, index) => (
            <div
              className="flex h-24 animate-pulse items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 motion-reduce:animate-none"
              key={index}
            >
              <div className="space-y-2">
                <div className="h-4 w-36 rounded bg-slate-800" />
                <div className="h-3 w-24 rounded bg-slate-800" />
              </div>
              <div className="h-8 w-24 rounded-full bg-slate-800" />
            </div>
          ))}
        </div>
      )}

      {type === 'detail' && (
        <div className="animate-pulse space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 motion-reduce:animate-none">
          <div className="h-6 w-1/4 rounded bg-slate-800" />
          <div className="h-10 w-1/2 rounded bg-slate-800" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-16 rounded bg-slate-800" />
            <div className="h-16 rounded bg-slate-800" />
            <div className="h-16 rounded bg-slate-800" />
            <div className="h-16 rounded bg-slate-800" />
          </div>
        </div>
      )}
    </div>
  )
}
