import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl sm:p-10 ${className}`}
    >
      {icon && (
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
          {icon}
        </div>
      )}

      <h2 className="mt-4 text-xl font-bold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
        {description}
      </p>

      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
