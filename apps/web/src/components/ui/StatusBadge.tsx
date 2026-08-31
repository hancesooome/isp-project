type StatusType =
  | 'active'
  | 'past_due'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'open'
  | 'paid'
  | 'overdue'

interface StatusBadgeProps {
  status: StatusType | string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    active: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
    approved: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
    paid: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',

    pending: 'border-amber-700 bg-amber-950/60 text-amber-200',
    open: 'border-amber-700 bg-amber-950/60 text-amber-200',

    rejected: 'border-red-800 bg-red-950/60 text-red-200',
    overdue: 'border-red-800 bg-red-950/60 text-red-200',
    past_due: 'border-red-800 bg-red-950/60 text-red-200',
  }

  const defaultStyle = 'border-slate-700 bg-slate-800/80 text-slate-200'
  const appliedStyle = styles[status] ?? defaultStyle
  const formattedText = status.replace(/_/g, ' ')

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${appliedStyle} ${className}`}
    >
      <span
        className={`mr-1.5 size-1.5 rounded-full ${
          status === 'active' || status === 'approved' || status === 'paid'
            ? 'bg-emerald-400'
            : status === 'pending' || status === 'open'
              ? 'bg-amber-400'
              : 'bg-red-400'
        }`}
        aria-hidden="true"
      />
      {formattedText}
    </span>
  )
}
