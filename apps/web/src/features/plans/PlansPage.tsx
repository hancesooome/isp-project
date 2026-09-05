import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { moneyFormatter as priceFormatter } from '../../lib/money'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
}

function isPlan(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const plan = value as Record<string, unknown>

  return (
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.slug === 'string' &&
    (typeof plan.description === 'string' || plan.description === null) &&
    typeof plan.price_cents === 'number' &&
    (plan.billing_interval === 'monthly' ||
      plan.billing_interval === 'yearly')
  )
}

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadPlans() {
      try {
        const response = await fetch('/api/plans', {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('PLANS_REQUEST_FAILED')
        }

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('plans' in result) ||
          !Array.isArray(result.plans) ||
          !result.plans.every(isPlan)
        ) {
          throw new Error('INVALID_PLANS_RESPONSE')
        }

        setPlans(result.plans)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load the available plans. Please try again later.')
      }
    }

    void loadPlans()

    return () => controller.abort()
  }, [])

  return (
    <section className="w-full text-slate-950">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Internet plans
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
          Choose the right plan for you
        </h1>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
          Compare our currently available internet service plans.
        </p>
      </header>

      <div className="mt-12">
        {error ? (
          <div className="mx-auto max-w-xl rounded-[14px] border border-red-200 bg-red-50 p-6 text-center" role="alert">
            <h2 className="font-semibold text-red-900">Could not load plans</h2>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        ) : plans === null ? (
          <div aria-label="Loading plans" aria-busy="true" className="grid gap-px overflow-hidden rounded-[14px] border border-slate-900/10 bg-slate-900/10 sm:grid-cols-2 lg:grid-cols-3" role="status">
            <span className="sr-only">Loading available plans…</span>
            {[0, 1, 2].map((item) => <div className="h-80 animate-pulse bg-white motion-reduce:animate-none" key={item} />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-[14px] border border-slate-900/10 bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">No plans available</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">There are currently no active internet plans available for selection.</p>
          </div>
        ) : (
        <div className={`grid gap-5 ${plans.length === 1 ? 'mx-auto max-w-md' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {plans.map((plan) => (
            <article
              className="flex min-h-80 flex-col rounded-[14px] border border-slate-900/10 bg-white p-7 shadow-[0_18px_50px_rgba(18,25,38,0.07)] sm:p-8"
              key={plan.id}
            >
              <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">Internet service</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em] text-slate-950">{plan.name}</h2>
              <p className="mt-3 min-h-12 leading-6 text-slate-600">
                {plan.description ?? 'Reliable internet service for your home.'}
              </p>
              <p className="mt-7 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                {priceFormatter.format(plan.price_cents / 100)}
              </p>
              <p className="mt-1 text-sm capitalize text-slate-500">
                per {plan.billing_interval === 'monthly' ? 'month' : 'year'}
              </p>
              <Link
                className="public-primary-button mt-auto inline-flex min-h-12 items-center justify-center rounded-[10px] px-5 text-sm font-semibold text-white shadow-lg shadow-blue-950/10 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                to={`/availability?plan=${encodeURIComponent(plan.id)}`}
              >
                Choose this plan
              </Link>
            </article>
          ))}
        </div>
      )}
      </div>
    </section>
  )
}
