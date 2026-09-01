import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

interface AdminApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  customer: { full_name: string | null } | null
  plan: { name: string } | null
}

interface AdminSubscription {
  id: string
  status: 'active' | 'past_due'
}

interface OverviewData {
  applications: AdminApplication[]
  subscriptions: AdminSubscription[]
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function isApplication(value: unknown): value is AdminApplication {
  if (typeof value !== 'object' || value === null) return false
  const application = value as Record<string, unknown>
  const customer = application.customer
  const plan = application.plan

  return typeof application.id === 'string' &&
    (application.status === 'pending' || application.status === 'approved' || application.status === 'rejected') &&
    typeof application.submitted_at === 'string' &&
    (customer === null || (typeof customer === 'object' && customer !== null && 'full_name' in customer && (typeof customer.full_name === 'string' || customer.full_name === null))) &&
    (plan === null || (typeof plan === 'object' && plan !== null && 'name' in plan && typeof plan.name === 'string'))
}

function isSubscription(value: unknown): value is AdminSubscription {
  if (typeof value !== 'object' || value === null) return false
  const subscription = value as Record<string, unknown>
  return typeof subscription.id === 'string' &&
    (subscription.status === 'active' || subscription.status === 'past_due')
}

export function AdminOverviewPage() {
  const { session } = useAuth()
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadOverview() {
      try {
        const headers = { Authorization: `Bearer ${session?.access_token ?? ''}` }
        const [applicationsResponse, subscriptionsResponse] = await Promise.all([
          fetch('/api/admin/applications', { headers, signal: controller.signal }),
          fetch('/api/admin/subscriptions', { headers, signal: controller.signal }),
        ])

        if (!applicationsResponse.ok || !subscriptionsResponse.ok) {
          throw new Error('ADMIN_OVERVIEW_REQUEST_FAILED')
        }

        const applicationsResult: unknown = await applicationsResponse.json()
        const subscriptionsResult: unknown = await subscriptionsResponse.json()

        if (
          typeof applicationsResult !== 'object' || applicationsResult === null ||
          !('applications' in applicationsResult) || !Array.isArray(applicationsResult.applications) ||
          !applicationsResult.applications.every(isApplication) ||
          typeof subscriptionsResult !== 'object' || subscriptionsResult === null ||
          !('subscriptions' in subscriptionsResult) || !Array.isArray(subscriptionsResult.subscriptions) ||
          !subscriptionsResult.subscriptions.every(isSubscription)
        ) {
          throw new Error('INVALID_ADMIN_OVERVIEW_RESPONSE')
        }

        setData({
          applications: applicationsResult.applications,
          subscriptions: subscriptionsResult.subscriptions,
        })
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load the operational overview. Please try again later.')
      }
    }

    void loadOverview()
    return () => controller.abort()
  }, [session])

  const metrics = data ? [
    { label: 'Total applications', value: data.applications.length, note: 'All submitted applications' },
    { label: 'Pending review', value: data.applications.filter((item) => item.status === 'pending').length, note: 'Applications needing attention' },
    { label: 'Active subscriptions', value: data.subscriptions.filter((item) => item.status === 'active').length, note: 'Current customer services' },
    { label: 'Past-due subscriptions', value: data.subscriptions.filter((item) => item.status === 'past_due').length, note: 'Billing attention required' },
  ] : []

  return (
    <section className="w-full">
      <header>
        <p className="text-xs font-semibold tracking-[0.14em] text-blue-400 uppercase">Admin portal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">Overview</h1>
        <p className="mt-2 text-sm text-slate-400">Monitor and manage the ISP operations currently available in the platform.</p>
      </header>

      {error ? (
        <div className="mt-7 rounded-[12px] border border-red-900/60 bg-red-950/40 p-5 text-sm text-red-200" role="alert">{error}</div>
      ) : data === null ? (
        <div aria-label="Loading operational overview" aria-busy="true" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status">
          <span className="sr-only">Loading admin overview…</span>
          {[0, 1, 2, 3].map((item) => <div className="h-28 animate-pulse rounded-[12px] border border-white/8 bg-white/5 motion-reduce:animate-none" key={item} />)}
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <article className="rounded-[12px] border border-white/8 bg-[linear-gradient(145deg,#161c26,#11161f)] p-5 shadow-sm" key={metric.label}>
                <p className="text-xs text-slate-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white">{metric.value}</p>
                <p className="mt-1 text-xs text-slate-500">{metric.note}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
            <section className="overflow-hidden rounded-[12px] border border-white/8 bg-[#11161f]" aria-labelledby="recent-applications-heading">
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-white" id="recent-applications-heading">Recent applications</h2>
                  <p className="mt-1 text-xs text-slate-500">Latest customer submissions</p>
                </div>
                <Link className="text-xs font-semibold text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" to="/admin/applications">View all →</Link>
              </div>
              {data.applications.length === 0 ? (
                <p className="p-5 text-sm text-slate-400">No service applications have been submitted.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="text-xs text-slate-500">
                      <tr><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Plan</th><th className="px-5 py-3 font-medium">Submitted</th><th className="px-5 py-3 font-medium">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {data.applications.slice(0, 5).map((application) => (
                        <tr className="text-slate-300" key={application.id}>
                          <td className="px-5 py-3 font-medium text-white">{application.customer?.full_name ?? 'Name unavailable'}</td>
                          <td className="px-5 py-3">{application.plan?.name ?? 'Plan unavailable'}</td>
                          <td className="px-5 py-3 text-xs">{dateFormatter.format(new Date(application.submitted_at))}</td>
                          <td className="px-5 py-3"><StatusBadge status={application.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="rounded-[12px] border border-white/8 bg-[#11161f] p-5" aria-labelledby="operations-heading">
              <h2 className="text-sm font-semibold text-white" id="operations-heading">Operations</h2>
              <p className="mt-1 text-xs text-slate-500">Implemented administration tools</p>
              <nav className="mt-4 divide-y divide-white/8" aria-label="Admin operations">
                <OperationLink description="Review and decide service requests" label="Applications" to="/admin/applications" />
                <OperationLink description="Create invoices for subscriptions" label="Billing" to="/admin/billing" />
              </nav>
            </aside>
          </div>
        </>
      )}
    </section>
  )
}

function OperationLink({ description, label, to }: { description: string; label: string; to: string }) {
  return (
    <Link className="flex min-h-16 items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" to={to}>
      <span><strong className="block text-sm font-medium text-slate-200">{label}</strong><small className="mt-1 block text-xs text-slate-500">{description}</small></span>
      <span aria-hidden="true" className="text-blue-300">→</span>
    </Link>
  )
}
