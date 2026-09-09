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
        <TriangleAlert aria-hidden="true" size={24} />
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
import { TriangleAlert } from 'lucide-react'
