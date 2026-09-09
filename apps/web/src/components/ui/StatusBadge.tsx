type StatusType =
  | 'active'
  | 'pending_activation'
  | 'past_due'
  | 'suspended'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'open'
  | 'paid'
  | 'overdue'
  | 'in_progress'
  | 'resolved'
  | 'closed'

interface StatusBadgeProps {
  status: StatusType | string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    active: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
    approved: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
    paid: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
    resolved: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',
    applied: 'border-emerald-700 bg-emerald-950/60 text-emerald-200',

    pending: 'border-amber-700 bg-amber-950/60 text-amber-200',
    pending_scheduling: 'border-amber-700 bg-amber-950/60 text-amber-200',
    reschedule_required: 'border-amber-700 bg-amber-950/60 text-amber-200',
    pending_activation: 'border-amber-700 bg-amber-950/60 text-amber-200',
    open: 'border-amber-700 bg-amber-950/60 text-amber-200',

    in_progress: 'border-blue-700 bg-blue-950/60 text-blue-200',
    scheduled: 'border-blue-700 bg-blue-950/60 text-blue-200',
    assigned: 'border-blue-700 bg-blue-950/60 text-blue-200',
    closed: 'border-slate-600 bg-slate-800/80 text-slate-200',
    canceled: 'border-slate-600 bg-slate-800/80 text-slate-200',
    cancelled: 'border-slate-600 bg-slate-800/80 text-slate-200',

    rejected: 'border-red-800 bg-red-950/60 text-red-200',
    overdue: 'border-red-800 bg-red-950/60 text-red-200',
    failed: 'border-red-800 bg-red-950/60 text-red-200',
    past_due: 'border-red-800 bg-red-950/60 text-red-200',
    suspended: 'border-red-800 bg-red-950/60 text-red-200',
  }

  const defaultStyle = 'border-slate-700 bg-slate-800/80 text-slate-200'
  const appliedStyle = styles[status] ?? defaultStyle
  const formattedText = status.replace(/_/g, ' ')
  const successStatuses = ['active', 'approved', 'paid', 'resolved', 'applied', 'completed']
  const pendingStatuses = ['pending', 'pending_scheduling', 'pending_activation', 'open', 'reschedule_required', 'scheduled', 'assigned', 'in_progress']
  const warningStatuses = ['overdue', 'past_due', 'suspended']
  const StatusIcon = successStatuses.includes(status)
    ? CircleCheck
    : pendingStatuses.includes(status)
      ? Clock3
      : warningStatuses.includes(status)
        ? TriangleAlert
        : ['rejected', 'failed', 'canceled', 'cancelled'].includes(status)
          ? CircleX
          : Info

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${appliedStyle} ${className}`}
    >
      <StatusIcon aria-hidden="true" className="mr-1.5 shrink-0" size={13} />
      {formattedText}
    </span>
  )
}
import { CircleCheck, CircleX, Clock3, Info, TriangleAlert } from 'lucide-react'
