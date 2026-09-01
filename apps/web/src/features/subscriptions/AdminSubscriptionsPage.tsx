import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

type SubscriptionStatus = 'active' | 'past_due' | 'canceled'
type StatusFilter = SubscriptionStatus | 'all'

interface AdminSubscription {
  id: string
  status: SubscriptionStatus
  started_at: string
  ended_at: string | null
  customer: { id: string; full_name: string | null } | null
  plan: { id: string; name: string } | null
}

interface AdminSubscriptionDetail extends AdminSubscription {
  created_at: string
  updated_at: string
  customer: {
    id: string
    full_name: string | null
    email: string | null
    customer_profile: {
      phone: string | null
      address: string | null
      installation_address: string | null
    } | null
  } | null
  plan: {
    id: string
    name: string
    slug: string
    speed_mbps: number | null
    price_cents: number
    billing_interval: 'monthly' | 'yearly'
    is_active: boolean
  } | null
  application: {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    submitted_at: string
    installation_address: string
  } | null
  billing: {
    total_invoices: number
    overdue_invoices: number
    outstanding_cents: number
  }
}

interface StatusUpdate {
  id: string
  status: SubscriptionStatus
  started_at: string
  ended_at: string | null
  updated_at: string
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' })
const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
})

const statusActions: Record<
  SubscriptionStatus,
  Array<{ label: string; status: SubscriptionStatus }>
> = {
  active: [
    { label: 'Mark past due', status: 'past_due' },
    { label: 'Cancel subscription', status: 'canceled' },
  ],
  past_due: [
    { label: 'Restore active', status: 'active' },
    { label: 'Cancel subscription', status: 'canceled' },
  ],
  canceled: [],
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isStatus(value: unknown): value is SubscriptionStatus {
  return value === 'active' || value === 'past_due' || value === 'canceled'
}

function isSubscription(value: unknown): value is AdminSubscription {
  if (typeof value !== 'object' || value === null) return false

  const subscription = value as Record<string, unknown>
  const customer = subscription.customer
  const plan = subscription.plan

  return (
    typeof subscription.id === 'string' &&
    isStatus(subscription.status) &&
    typeof subscription.started_at === 'string' &&
    isNullableString(subscription.ended_at) &&
    (customer === null ||
      (typeof customer === 'object' &&
        'id' in customer &&
        typeof customer.id === 'string' &&
        'full_name' in customer &&
        isNullableString(customer.full_name))) &&
    (plan === null ||
      (typeof plan === 'object' &&
        'id' in plan &&
        typeof plan.id === 'string' &&
        'name' in plan &&
        typeof plan.name === 'string'))
  )
}

function isSubscriptionDetail(value: unknown): value is AdminSubscriptionDetail {
  if (!isSubscription(value)) return false

  const subscription = value as unknown as Record<string, unknown>
  const customer = subscription.customer
  const plan = subscription.plan
  const application = subscription.application
  const billing = subscription.billing

  return (
    typeof subscription.created_at === 'string' &&
    typeof subscription.updated_at === 'string' &&
    (customer === null ||
      (typeof customer === 'object' &&
        'email' in customer &&
        isNullableString(customer.email) &&
        'customer_profile' in customer &&
        (customer.customer_profile === null ||
          (typeof customer.customer_profile === 'object' &&
            'phone' in customer.customer_profile &&
            isNullableString(customer.customer_profile.phone) &&
            'address' in customer.customer_profile &&
            isNullableString(customer.customer_profile.address) &&
            'installation_address' in customer.customer_profile &&
            isNullableString(customer.customer_profile.installation_address))))) &&
    (plan === null ||
      (typeof plan === 'object' &&
        'slug' in plan &&
        typeof plan.slug === 'string' &&
        'speed_mbps' in plan &&
        (typeof plan.speed_mbps === 'number' || plan.speed_mbps === null) &&
        'price_cents' in plan &&
        typeof plan.price_cents === 'number' &&
        'billing_interval' in plan &&
        (plan.billing_interval === 'monthly' || plan.billing_interval === 'yearly') &&
        'is_active' in plan &&
        typeof plan.is_active === 'boolean')) &&
    (application === null ||
      (typeof application === 'object' &&
        'id' in application &&
        typeof application.id === 'string' &&
        'status' in application &&
        (application.status === 'pending' || application.status === 'approved' || application.status === 'rejected') &&
        'submitted_at' in application &&
        typeof application.submitted_at === 'string' &&
        'installation_address' in application &&
        typeof application.installation_address === 'string')) &&
    typeof billing === 'object' &&
    billing !== null &&
    'total_invoices' in billing &&
    typeof billing.total_invoices === 'number' &&
    'overdue_invoices' in billing &&
    typeof billing.overdue_invoices === 'number' &&
    'outstanding_cents' in billing &&
    typeof billing.outstanding_cents === 'number'
  )
}

function isStatusUpdate(value: unknown): value is StatusUpdate {
  if (typeof value !== 'object' || value === null) return false
  const subscription = value as Record<string, unknown>
  return (
    typeof subscription.id === 'string' &&
    isStatus(subscription.status) &&
    typeof subscription.started_at === 'string' &&
    isNullableString(subscription.ended_at) &&
    typeof subscription.updated_at === 'string'
  )
}

export function AdminSubscriptionsPage() {
  const { session } = useAuth()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadSubscriptions() {
      try {
        const response = await fetch(
          `/api/admin/subscriptions?status=${encodeURIComponent(filter)}`,
          {
            headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
            signal: controller.signal,
          },
        )
        if (!response.ok) throw new Error('ADMIN_SUBSCRIPTIONS_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('subscriptions' in result) ||
          !Array.isArray(result.subscriptions) ||
          !result.subscriptions.every(isSubscription)
        ) {
          throw new Error('INVALID_ADMIN_SUBSCRIPTIONS_RESPONSE')
        }

        setSubscriptions(result.subscriptions)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load subscriptions. Please try again later.')
      }
    }

    void loadSubscriptions()
    return () => controller.abort()
  }, [filter, session])

  return (
    <section className="w-full max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Admin portal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">Subscriptions</h1>
          <p className="mt-2 text-sm text-slate-400">Inspect customer services and subscription status.</p>
        </div>
        <label className="text-xs font-medium text-slate-400">
          Status
          <select className="ml-2 min-h-10 rounded-[9px] border border-white/10 bg-[#11161f] px-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-400" onChange={(event) => {
            setSubscriptions(null)
            setError(null)
            setFilter(event.target.value as StatusFilter)
          }} value={filter}>
            <option value="all">All</option><option value="active">Active</option><option value="past_due">Past due</option><option value="canceled">Canceled</option>
          </select>
        </label>
      </header>

      <div className="mt-7">
        {error ? (
          <ErrorPanel message={error} title="Subscriptions unavailable" />
        ) : subscriptions === null ? (
          <PageSkeleton count={4} type="list" />
        ) : subscriptions.length === 0 ? (
          <EmptyState description="No subscriptions match this status filter." title="No subscriptions found" />
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-white/8 bg-[#11161f]">
            <div className="hidden grid-cols-[1.3fr_1fr_0.8fr_0.8fr_auto] gap-4 border-b border-white/8 px-5 py-3 text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase md:grid">
              <span>Customer</span><span>Plan</span><span>Started</span><span>Status</span><span>Account</span>
            </div>
            <ul className="divide-y divide-white/8" role="list">
              {subscriptions.map((subscription) => (
                <li className="grid gap-3 px-5 py-4 md:grid-cols-[1.3fr_1fr_0.8fr_0.8fr_auto] md:items-center" key={subscription.id}>
                  <p className="font-semibold text-white">{subscription.customer?.full_name ?? 'Name unavailable'}</p>
                  <p className="text-sm text-slate-300">{subscription.plan?.name ?? 'Plan unavailable'}</p>
                  <p className="text-sm text-slate-400">{dateFormatter.format(new Date(subscription.started_at))}</p>
                  <div><StatusBadge status={subscription.status} /></div>
                  <Link className="text-sm font-semibold text-blue-300 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" to={`/admin/subscriptions/${encodeURIComponent(subscription.id)}`}>View details →</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

export function AdminSubscriptionDetailsPage({ subscriptionId }: { subscriptionId: string }) {
  const { session } = useAuth()
  const [subscription, setSubscription] = useState<AdminSubscriptionDetail | null>()
  const [error, setError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadSubscription() {
      try {
        const response = await fetch(`/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (response.status === 404) {
          setSubscription(null)
          return
        }
        if (!response.ok) throw new Error('ADMIN_SUBSCRIPTION_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (typeof result !== 'object' || result === null || !('subscription' in result) || !isSubscriptionDetail(result.subscription)) {
          throw new Error('INVALID_ADMIN_SUBSCRIPTION_RESPONSE')
        }
        setSubscription(result.subscription)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load this subscription. Please try again later.')
      }
    }

    void loadSubscription()
    return () => controller.abort()
  }, [session, subscriptionId])

  async function updateStatus(status: SubscriptionStatus) {
    if (!session || !subscription || isUpdating) return
    if (status === 'canceled' && !window.confirm('Cancel this subscription? This action cannot be reversed.')) return

    setIsUpdating(true)
    setStatusError(null)
    setStatusSuccess(null)

    try {
      const response = await fetch(`/api/admin/subscriptions/${encodeURIComponent(subscription.id)}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('ADMIN_SUBSCRIPTION_STATUS_FAILED')

      const result: unknown = await response.json()
      if (typeof result !== 'object' || result === null || !('subscription' in result) || !isStatusUpdate(result.subscription)) {
        throw new Error('INVALID_SUBSCRIPTION_STATUS_RESPONSE')
      }

      const updated = result.subscription
      setSubscription((current) => current ? { ...current, status: updated.status, ended_at: updated.ended_at, updated_at: updated.updated_at } : current)
      setStatusSuccess(`Subscription marked ${updated.status.replace('_', ' ')}.`)
    } catch {
      setStatusError('We could not update the subscription status. Refresh and try again.')
    } finally {
      setIsUpdating(false)
    }
  }

  if (error) return <ErrorPanel message={error} title="Subscription unavailable" />
  if (subscription === undefined) return <PageSkeleton type="detail" />
  if (subscription === null) return <EmptyState description="This subscription does not exist." title="Subscription not found" />

  return (
    <section className="w-full max-w-6xl">
      <Link className="text-sm font-semibold text-blue-300 hover:text-blue-200" to="/admin/subscriptions">← Back to subscriptions</Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Subscription</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">{subscription.customer?.full_name ?? 'Unnamed customer'}</h1>
          <p className="mt-2 text-sm text-slate-400">{subscription.plan?.name ?? 'Plan unavailable'}</p>
        </div>
        <StatusBadge status={subscription.status} />
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <InfoCard title="Service information">
          <Detail label="Plan" value={subscription.plan?.name} />
          <Detail label="Speed" value={subscription.plan?.speed_mbps ? `${subscription.plan.speed_mbps.toLocaleString()} Mbps` : null} />
          <Detail label="Plan price" value={subscription.plan ? `${currencyFormatter.format(subscription.plan.price_cents / 100)} per ${subscription.plan.billing_interval === 'monthly' ? 'month' : 'year'}` : null} />
          <Detail label="Started" value={dateFormatter.format(new Date(subscription.started_at))} />
          <Detail label="Ended" value={subscription.ended_at ? dateFormatter.format(new Date(subscription.ended_at)) : null} />
          <Detail label="Installation address" value={subscription.customer?.customer_profile?.installation_address ?? subscription.application?.installation_address} />
        </InfoCard>

        <InfoCard title="Customer and billing">
          <Detail label="Email" value={subscription.customer?.email} />
          <Detail label="Phone" value={subscription.customer?.customer_profile?.phone} />
          <Detail label="Address" value={subscription.customer?.customer_profile?.address} />
          <Detail label="Outstanding" value={currencyFormatter.format(subscription.billing.outstanding_cents / 100)} />
          <Detail label="Invoices" value={String(subscription.billing.total_invoices)} />
          <Detail label="Overdue invoices" value={String(subscription.billing.overdue_invoices)} />
        </InfoCard>
      </div>

      <section className="mt-5 rounded-[12px] border border-white/8 bg-[#11161f] p-5" aria-labelledby="status-actions-heading">
        <h2 className="text-sm font-semibold text-white" id="status-actions-heading">Status actions</h2>
        {statusActions[subscription.status].length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Canceled subscriptions are retained as history and cannot be reactivated.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {statusActions[subscription.status].map((action) => (
              <button className="min-h-10 rounded-[9px] border border-white/10 bg-white/6 px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50" disabled={isUpdating} key={action.status} onClick={() => void updateStatus(action.status)} type="button">{isUpdating ? 'Updating…' : action.label}</button>
            ))}
          </div>
        )}
        {statusError ? <p className="mt-3 text-xs text-red-300" role="alert">{statusError}</p> : null}
        {statusSuccess ? <p className="mt-3 text-xs text-emerald-300" role="status">{statusSuccess}</p> : null}
      </section>
    </section>
  )
}

function InfoCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-[12px] border border-white/8 bg-[#11161f] p-5">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-200">{value ?? 'Not provided'}</dd></div>
}
