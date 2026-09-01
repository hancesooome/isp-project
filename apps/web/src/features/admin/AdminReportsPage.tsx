import { useEffect, useState } from 'react'

import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { useAuth } from '../auth/auth-context'

interface ReportsOverview {
  total_customers: number
  active_subscriptions: number
  pending_applications: number
  open_invoices: number
  overdue_invoices: number
  unresolved_support_tickets: number
  successful_payments: number
  successful_payment_amount_cents: number
  payment_period_start: string
  payment_period_end_exclusive: string
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
})
const periodFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isReportsOverview(value: unknown): value is ReportsOverview {
  if (typeof value !== 'object' || value === null) return false

  const metrics = value as Record<string, unknown>
  return (
    isNonNegativeInteger(metrics.total_customers) &&
    isNonNegativeInteger(metrics.active_subscriptions) &&
    isNonNegativeInteger(metrics.pending_applications) &&
    isNonNegativeInteger(metrics.open_invoices) &&
    isNonNegativeInteger(metrics.overdue_invoices) &&
    isNonNegativeInteger(metrics.unresolved_support_tickets) &&
    isNonNegativeInteger(metrics.successful_payments) &&
    isNonNegativeInteger(metrics.successful_payment_amount_cents) &&
    typeof metrics.payment_period_start === 'string' &&
    typeof metrics.payment_period_end_exclusive === 'string'
  )
}

export function AdminReportsPage() {
  const { session } = useAuth()
  const [metrics, setMetrics] = useState<ReportsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadReports() {
      try {
        const response = await fetch('/api/admin/reports/overview', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('ADMIN_REPORTS_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('metrics' in result) ||
          !isReportsOverview(result.metrics)
        ) {
          throw new Error('INVALID_ADMIN_REPORTS_RESPONSE')
        }

        setMetrics(result.metrics)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load the reports overview. Please try again later.')
      }
    }

    void loadReports()
    return () => controller.abort()
  }, [session])

  return (
    <section className="w-full max-w-6xl">
      <header>
        <p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Admin portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">Reports overview</h1>
        <p className="mt-2 text-sm text-slate-400">Current operational counts and recorded payment activity.</p>
      </header>

      <div className="mt-7">
        {error ? (
          <ErrorPanel message={error} title="Reports unavailable" />
        ) : metrics === null ? (
          <PageSkeleton count={6} type="list" />
        ) : (
          <div className="space-y-7">
            <section aria-labelledby="operations-heading">
              <SectionHeading id="operations-heading" title="Current operations" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Total customers" value={metrics.total_customers.toLocaleString()} />
                <MetricCard label="Active subscriptions" value={metrics.active_subscriptions.toLocaleString()} />
                <MetricCard label="Pending applications" value={metrics.pending_applications.toLocaleString()} />
                <MetricCard label="Open invoices" value={metrics.open_invoices.toLocaleString()} />
                <MetricCard label="Overdue invoices" tone={metrics.overdue_invoices > 0 ? 'attention' : 'default'} value={metrics.overdue_invoices.toLocaleString()} />
                <MetricCard label="Unresolved support tickets" value={metrics.unresolved_support_tickets.toLocaleString()} />
              </div>
            </section>

            <section aria-labelledby="payments-heading">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <SectionHeading id="payments-heading" title="Successful payments" />
                <p className="text-xs text-slate-500">UTC calendar month · {periodFormatter.format(new Date(metrics.payment_period_start))}</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <MetricCard label="Payments recorded" value={metrics.successful_payments.toLocaleString()} />
                <MetricCard label="Amount recorded" value={currencyFormatter.format(metrics.successful_payment_amount_cents / 100)} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Includes only payments with a succeeded status and a payment timestamp within the displayed UTC month. This is recorded payment activity, not recognized revenue.</p>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}

function SectionHeading({ id, title }: { id: string; title: string }) {
  return <h2 className="text-sm font-semibold text-slate-200" id={id}>{title}</h2>
}

function MetricCard({ label, tone = 'default', value }: { label: string; tone?: 'default' | 'attention'; value: string }) {
  return (
    <article className={`rounded-[12px] border p-5 ${tone === 'attention' ? 'border-red-500/20 bg-red-950/15' : 'border-white/8 bg-[#11161f]'}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-[-0.03em] ${tone === 'attention' ? 'text-red-200' : 'text-white'}`}>{value}</p>
    </article>
  )
}
