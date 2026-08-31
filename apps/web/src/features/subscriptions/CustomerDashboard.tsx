import { useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'

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
    return (
      <p
        className="w-full max-w-2xl rounded-xl border border-red-900 bg-red-950/50 p-5 text-center text-red-200"
        role="alert"
      >
        {error}
      </p>
    )
  }

  if (subscription === undefined || application === undefined) {
    return <p role="status">Loading your account...</p>
  }

  return (
    <section className="w-full max-w-4xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Customer portal
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Your account
        </h1>
        <p className="mt-2 text-slate-400">
          {user?.email ?? 'Your ISP service account'}
        </p>
      </header>

      {subscription ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Current plan</p>
                <h2 className="mt-1 text-2xl font-bold text-white">
                  {subscription.plan?.name ?? 'Plan unavailable'}
                </h2>
                {subscription.plan?.description ? (
                  <p className="mt-2 text-slate-400">
                    {subscription.plan.description}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full border border-emerald-700 bg-emerald-950/50 px-3 py-1 text-sm font-semibold capitalize text-emerald-200">
                {subscription.status.replace('_', ' ')}
              </span>
            </div>
          </article>

          <SummaryCard
            label="Plan price"
            value={
              subscription.plan
                ? `${priceFormatter.format(subscription.plan.price_cents / 100)} per ${subscription.plan.billing_interval === 'monthly' ? 'month' : 'year'}`
                : 'Unavailable'
            }
          />
          <SummaryCard
            label="Service started"
            value={dateFormatter.format(new Date(subscription.started_at))}
          />
        </div>
      ) : (
        <ApplicationSummary application={application} />
      )}

      <nav className="mt-6 flex flex-wrap gap-4" aria-label="Account navigation">
        <a className="font-medium text-sky-400 hover:text-sky-300" href="/account/invoices">
          View invoices
        </a>
        <a className="font-medium text-sky-400 hover:text-sky-300" href="/account/statements">
          View statements
        </a>
        <a className="font-medium text-sky-400 hover:text-sky-300" href="/account/application">
          View application status
        </a>
        {!subscription && !application ? (
          <a className="font-medium text-sky-400 hover:text-sky-300" href="/plans">
            View available plans
          </a>
        ) : null}
      </nav>
    </section>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </article>
  )
}

function ApplicationSummary({
  application,
}: {
  application: CustomerApplication | null
}) {
  if (!application) {
    return (
      <article className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white">No internet service yet</h2>
        <p className="mt-2 text-slate-400">
          Choose a plan and submit an application to get started.
        </p>
      </article>
    )
  }

  const messages = {
    pending: 'Your service application is waiting for admin review.',
    approved: 'Your application is approved. Your service account is being prepared.',
    rejected: 'Your application was not approved. View its status for more information.',
  }

  return (
    <article className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <p className="text-sm text-slate-400">Latest application</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">
          {application.plan?.name ?? 'Selected plan unavailable'}
        </h2>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-sm font-semibold capitalize text-slate-200">
          {application.status}
        </span>
      </div>
      <p className="mt-3 text-slate-400">{messages[application.status]}</p>
    </article>
  )
}
