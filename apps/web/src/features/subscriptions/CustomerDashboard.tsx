import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'

interface CustomerSubscription {
  id: string
  status: 'active' | 'past_due'
  started_at: string
  plan: {
    id: string
    name: string
    description: string | null
    price_cents: number
    billing_interval: 'monthly' | 'yearly'
  } | null
}

interface CustomerApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  rejection_reason: string | null
  plan: { name: string } | null
}

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
})

function isSubscription(value: unknown): value is CustomerSubscription {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const subscription = value as Record<string, unknown>
  const plan = subscription.plan

  return (
    typeof subscription.id === 'string' &&
    (subscription.status === 'active' || subscription.status === 'past_due') &&
    typeof subscription.started_at === 'string' &&
    (plan === null ||
      (typeof plan === 'object' &&
        plan !== null &&
        'id' in plan &&
        typeof plan.id === 'string' &&
        'name' in plan &&
        typeof plan.name === 'string' &&
        'description' in plan &&
        (typeof plan.description === 'string' || plan.description === null) &&
        'price_cents' in plan &&
        typeof plan.price_cents === 'number' &&
        'billing_interval' in plan &&
        (plan.billing_interval === 'monthly' ||
          plan.billing_interval === 'yearly')))
  )
}

function isApplication(value: unknown): value is CustomerApplication {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const application = value as Record<string, unknown>
  const plan = application.plan

  return (
    typeof application.id === 'string' &&
    (application.status === 'pending' ||
      application.status === 'approved' ||
      application.status === 'rejected') &&
    typeof application.submitted_at === 'string' &&
    (typeof application.rejection_reason === 'string' ||
      application.rejection_reason === null) &&
    (plan === null ||
      (typeof plan === 'object' &&
        plan !== null &&
        'name' in plan &&
        typeof plan.name === 'string'))
  )
}

export function CustomerDashboard() {
  const { session, user } = useAuth()
  const firstName = getFirstName(user?.user_metadata.full_name)
  const [subscription, setSubscription] = useState<
    CustomerSubscription | null
  >()
  const [application, setApplication] = useState<CustomerApplication | null>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      return
    }

    const controller = new AbortController()

    async function loadDashboard() {
      try {
        const headers = { Authorization: `Bearer ${session?.access_token ?? ''}` }
        const [subscriptionResponse, applicationResponse] = await Promise.all([
          fetch('/api/subscription', { headers, signal: controller.signal }),
          fetch('/api/applications/current', {
            headers,
            signal: controller.signal,
          }),
        ])

        if (!subscriptionResponse.ok || !applicationResponse.ok) {
          throw new Error('DASHBOARD_REQUEST_FAILED')
        }

        const subscriptionResult: unknown = await subscriptionResponse.json()
        const applicationResult: unknown = await applicationResponse.json()

        if (
          typeof subscriptionResult !== 'object' ||
          subscriptionResult === null ||
          !('subscription' in subscriptionResult) ||
          (subscriptionResult.subscription !== null &&
            !isSubscription(subscriptionResult.subscription)) ||
          typeof applicationResult !== 'object' ||
          applicationResult === null ||
          !('application' in applicationResult) ||
          (applicationResult.application !== null &&
            !isApplication(applicationResult.application))
        ) {
          throw new Error('INVALID_DASHBOARD_RESPONSE')
        }

        setSubscription(subscriptionResult.subscription)
        setApplication(applicationResult.application)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load your account. Please try again later.')
      }
    }

    void loadDashboard()
    return () => controller.abort()
  }, [session])

  if (error) {
    return <ErrorPanel message={error} title="Account unavailable" />
  }

  if (subscription === undefined || application === undefined) {
    return <PageSkeleton type="detail" />
  }

  return (
    <section className="w-full">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Customer portal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            {firstName ? `${getGreeting()}, ${firstName}` : 'Welcome back'}{' '}
            <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">Here&apos;s what&apos;s happening with your account.</p>
        </div>
        {user?.email ? <p className="hidden text-sm text-slate-500 sm:block">{user.email}</p> : null}
      </header>

      {subscription ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.45fr_0.8fr]">
          <article className="relative overflow-hidden rounded-[18px] border border-slate-900/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(238,241,247,0.78))] p-6 shadow-[0_18px_50px_rgba(18,25,38,0.08)] sm:p-8">
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-md">
                <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">Your internet</p>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-slate-950">
                  {subscription.plan?.name ?? 'Plan unavailable'}
                </h2>
                {subscription.plan?.description ? (
                  <p className="mt-2 leading-6 text-slate-600">
                    {subscription.plan.description}
                  </p>
                ) : null}
              </div>
              <StatusBadge status={subscription.status} />
            </div>
            <div className="relative z-10 mt-8 grid gap-5 border-t border-slate-900/8 pt-6 sm:grid-cols-2">
              <Summary label="Plan price" value={subscription.plan ? `${priceFormatter.format(subscription.plan.price_cents / 100)} per ${subscription.plan.billing_interval === 'monthly' ? 'month' : 'year'}` : 'Unavailable'} />
              <Summary label="Service started" value={dateFormatter.format(new Date(subscription.started_at))} />
            </div>
            <svg aria-hidden="true" className="absolute right-7 bottom-7 hidden text-blue-500/15 sm:block" fill="none" height="104" stroke="currentColor" strokeLinecap="round" strokeWidth="4" viewBox="0 0 120 100" width="124">
              <path d="M18 40a62 62 0 0184 0M34 57a40 40 0 0152 0M50 73a18 18 0 0120 0" />
              <circle cx="60" cy="86" fill="currentColor" r="4" stroke="none" />
            </svg>
          </article>

          <aside className="rounded-[18px] border border-slate-900/8 bg-white p-6 shadow-[0_18px_50px_rgba(18,25,38,0.06)] sm:p-7" aria-labelledby="account-actions-heading">
            <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase" id="account-actions-heading">Account actions</p>
            <nav className="mt-4 divide-y divide-slate-900/8" aria-label="Account actions">
              <ActionLink label="Application status" to="/account/application" />
              <ActionLink label="View invoices" to="/account/invoices" />
              <ActionLink label="Download statements" to="/account/statements" />
            </nav>
          </aside>

          {application ? (
            <article className="rounded-[18px] border border-slate-900/8 bg-white p-6 shadow-[0_18px_50px_rgba(18,25,38,0.05)] lg:col-span-2 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">Latest application</p>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{application.plan?.name ?? 'Selected plan unavailable'}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Submitted {dateFormatter.format(new Date(application.submitted_at))}</p>
                </div>
                <StatusBadge status={application.status} />
              </div>
              <Link className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/account/application">View application <span aria-hidden="true" className="ml-2">→</span></Link>
            </article>
          ) : null}
        </div>
      ) : (
        <ApplicationSummary application={application} />
      )}
    </section>
  )
}

function getFirstName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim().split(/\s+/)[0] || null
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function ActionLink({ label, to }: { label: string; to: string }) {
  return (
    <Link className="flex min-h-12 items-center justify-between text-sm font-medium text-slate-700 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to={to}>
      <span>{label}</span><span aria-hidden="true">→</span>
    </Link>
  )
}

function ApplicationSummary({
  application,
}: {
  application: CustomerApplication | null
}) {
  if (!application) {
    return (
      <EmptyState
        className="mt-8"
        description="Choose a plan and submit an application to get started with internet service."
        title="No internet service yet"
      />
    )
  }

  const messages = {
    pending: 'Your service application is waiting for admin review.',
    approved: 'Your application is approved. Your service account is being prepared.',
    rejected: 'Your application was not approved. View its status for more information.',
  }

  return (
    <article className="mt-8 rounded-[18px] border border-slate-900/8 bg-white p-6 shadow-[0_18px_50px_rgba(18,25,38,0.06)]">
      <p className="text-sm text-slate-500">Latest application</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-950">
          {application.plan?.name ?? 'Selected plan unavailable'}
        </h2>
        <StatusBadge status={application.status} />
      </div>
      <p className="mt-3 text-slate-600">{messages[application.status]}</p>
    </article>
  )
}
