interface ErrorPanelProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorPanel({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  className = '',
}: ErrorPanelProps) {
  return (
    <div
      className={`w-full rounded-2xl border border-red-900/60 bg-red-950/40 p-6 text-center shadow-lg ${className}`}
      role="alert"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-900/30 text-red-400">
        <svg
          aria-hidden="true"
          fill="none"
          height="24"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="24"
        >
          <path
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className="mt-4 text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm text-red-200">{message}</p>

      {onRetry && (
        <button
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-red-900/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-900/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
          onClick={onRetry}
          type="button"
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
