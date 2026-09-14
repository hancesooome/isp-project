import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

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
  status: 'active' | 'past_due' | 'suspended'
}

type AttentionKey = 'application_reviews' | 'approved_without_installation' |
  'installation_scheduling' | 'unassigned_installations' |
  'installation_intervention' | 'support_awaiting_reply' |
  'overdue_invoices' | 'cancellation_reviews'

interface AttentionCount {
  attention_key: AttentionKey
  attention_count: number
}

interface OverviewData {
  applications: AdminApplication[]
  subscriptions: AdminSubscription[]
  attention: AttentionCount[]
}

const attentionDefinitions: Record<AttentionKey, { label: string; to: string }> = {
  application_reviews: { label: 'Applications awaiting review', to: '/admin/applications' },
  approved_without_installation: { label: 'Approved without installation', to: '/admin/applications' },
  installation_scheduling: { label: 'Installation scheduling', to: '/admin/installations' },
  unassigned_installations: { label: 'Unassigned technician jobs', to: '/admin/installations' },
  installation_intervention: { label: 'Installation intervention', to: '/admin/installations' },
  support_awaiting_reply: { label: 'Support awaiting reply', to: '/admin/support' },
  overdue_invoices: { label: 'Overdue billing actions', to: '/admin/billing' },
  cancellation_reviews: { label: 'Cancellation requests', to: '/admin/cancellations' },
}

const attentionKeys = Object.keys(attentionDefinitions) as AttentionKey[]

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
    (subscription.status === 'active' || subscription.status === 'past_due' || subscription.status === 'suspended')
}

function isAttentionCount(value: unknown): value is AttentionCount {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.attention_key === 'string' &&
    attentionKeys.includes(item.attention_key as AttentionKey) &&
    typeof item.attention_count === 'number' &&
    Number.isInteger(item.attention_count) &&
    item.attention_count >= 0
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
        const [applicationsResponse, subscriptionsResponse, attentionResponse] = await Promise.all([
          fetch('/api/admin/applications', { headers, signal: controller.signal }),
          fetch('/api/admin/subscriptions', { headers, signal: controller.signal }),
          fetch('/api/admin/attention', { headers, signal: controller.signal }),
        ])

        if (!applicationsResponse.ok || !subscriptionsResponse.ok || !attentionResponse.ok) {
          throw new Error('ADMIN_OVERVIEW_REQUEST_FAILED')
        }

        const applicationsResult: unknown = await applicationsResponse.json()
        const subscriptionsResult: unknown = await subscriptionsResponse.json()
        const attentionResult: unknown = await attentionResponse.json()

        if (
          typeof applicationsResult !== 'object' || applicationsResult === null ||
          !('applications' in applicationsResult) || !Array.isArray(applicationsResult.applications) ||
          !applicationsResult.applications.every(isApplication) ||
          typeof subscriptionsResult !== 'object' || subscriptionsResult === null ||
          !('subscriptions' in subscriptionsResult) || !Array.isArray(subscriptionsResult.subscriptions) ||
          !subscriptionsResult.subscriptions.every(isSubscription) ||
          typeof attentionResult !== 'object' || attentionResult === null ||
          !('attention' in attentionResult) || !Array.isArray(attentionResult.attention) ||
          !attentionResult.attention.every(isAttentionCount)
        ) {
          throw new Error('INVALID_ADMIN_OVERVIEW_RESPONSE')
        }

        setData({
          applications: applicationsResult.applications,
          subscriptions: subscriptionsResult.subscriptions,
          attention: attentionResult.attention,
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
    { label: 'Suspended subscriptions', value: data.subscriptions.filter((item) => item.status === 'suspended').length, note: 'Operational suspension status' },
  ] : []
  const unresolvedAttention = data?.attention.filter((item) => item.attention_count > 0) ?? []
  const attentionTotal = unresolvedAttention.reduce((total, item) => total + item.attention_count, 0)

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
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map((metric) => (
              <article className="rounded-[12px] border border-white/8 bg-[linear-gradient(145deg,#161c26,#11161f)] p-5 shadow-sm" key={metric.label}>
                <p className="text-xs text-slate-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-white">{metric.value}</p>
                <p className="mt-1 text-xs text-slate-500">{metric.note}</p>
              </article>
            ))}
          </div>

          <section className="mt-4 overflow-hidden rounded-[12px] border border-white/8 bg-[#11161f]" aria-labelledby="attention-required-heading">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white" id="attention-required-heading">Attention required</h2>
                <p className="mt-1 text-xs text-slate-500">Authoritative unresolved operational work</p>
              </div>
              <span className="min-w-8 rounded-full bg-amber-400/12 px-2.5 py-1 text-center text-xs font-semibold text-amber-300" aria-label={`${attentionTotal} unresolved items`}>{attentionTotal}</span>
            </div>
            {unresolvedAttention.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-400">No unresolved operational work requires attention.</p>
            ) : (
              <nav className="divide-y divide-white/8" aria-label="Unresolved admin work">
                {unresolvedAttention.map((item) => {
                  const definition = attentionDefinitions[item.attention_key]
                  return <Link className="flex min-h-12 items-center justify-between gap-4 px-5 py-3 text-sm transition hover:bg-white/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400" key={item.attention_key} to={definition.to}><span className="font-medium text-slate-200">{definition.label}</span><span className="flex items-center gap-3"><strong className="font-semibold text-white">{item.attention_count}</strong><ArrowRight aria-hidden="true" className="text-blue-300" size={15} /></span></Link>
                })}
              </nav>
            )}
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
            <section className="overflow-hidden rounded-[12px] border border-white/8 bg-[#11161f]" aria-labelledby="recent-applications-heading">
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-white" id="recent-applications-heading">Recent applications</h2>
                  <p className="mt-1 text-xs text-slate-500">Latest customer submissions</p>
                </div>
                <Link className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" to="/admin/applications">View all <ArrowRight aria-hidden="true" size={14} /></Link>
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
      <ArrowRight aria-hidden="true" className="text-blue-300" size={16} />
    </Link>
  )
}
