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
              className="skeleton-surface skeleton-shimmer h-48 rounded-[18px] p-6"
              key={index}
            >
              <div className="skeleton-fill h-3.5 w-1/3 rounded-full" />
              <div className="skeleton-fill mt-4 h-6 w-2/3 rounded-full" />
              <div className="skeleton-fill mt-7 h-3.5 w-full rounded-full" />
              <div className="skeleton-fill mt-2.5 h-3.5 w-4/5 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {type === 'list' && (
        <div className="space-y-4">
          {Array.from({ length: count }).map((_, index) => (
            <div
              className="skeleton-surface skeleton-shimmer flex h-24 items-center justify-between rounded-[14px] p-6"
              key={index}
            >
              <div className="space-y-2">
                <div className="skeleton-fill h-3.5 w-36 rounded-full" />
                <div className="skeleton-fill h-3 w-24 rounded-full" />
              </div>
              <div className="skeleton-fill h-8 w-24 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {type === 'detail' && (
        <div className="skeleton-surface skeleton-shimmer space-y-6 rounded-[18px] p-8">
          <div className="skeleton-fill h-5 w-1/4 rounded-full" />
          <div className="skeleton-fill h-9 w-1/2 rounded-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="skeleton-fill h-16 rounded-[14px]" />
            <div className="skeleton-fill h-16 rounded-[14px]" />
            <div className="skeleton-fill h-16 rounded-[14px]" />
            <div className="skeleton-fill h-16 rounded-[14px]" />
          </div>
        </div>
      )}
    </div>
  )
}
