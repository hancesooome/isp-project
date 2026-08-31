import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
}

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

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
    <section className="w-full max-w-6xl">
      <header className="text-center">
        <Link
          className="mb-4 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
          to="/"
        >
          ← Back to home
        </Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Internet plans
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Choose the right plan for you
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-400">
          Compare our currently available internet service plans.
        </p>
        <Link
          className="mt-5 inline-block font-medium text-sky-400 hover:text-sky-300"
          to="/availability"
        >
          Check service availability
        </Link>
      </header>

      {error ? (
        <p
          className="mx-auto mt-10 max-w-xl rounded-xl border border-red-900 bg-red-950/50 p-5 text-center text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : plans === null ? (
        <p className="mt-10 text-center text-slate-300" role="status">
          Loading plans...
        </p>
      ) : plans.length === 0 ? (
        <p className="mt-10 text-center text-slate-300" role="status">
          No plans are currently available.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
              key={plan.id}
            >
              <h2 className="text-2xl font-bold text-white">{plan.name}</h2>
              <p className="mt-3 min-h-12 text-slate-400">
                {plan.description ?? 'Reliable internet service for your home.'}
              </p>
              <p className="mt-6 text-3xl font-bold text-sky-400">
                {priceFormatter.format(plan.price_cents / 100)}
              </p>
              <p className="mt-1 text-sm capitalize text-slate-400">
                per {plan.billing_interval === 'monthly' ? 'month' : 'year'}
              </p>
              <Link
                className="mt-6 inline-block rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400"
                to={`/availability?plan=${encodeURIComponent(plan.id)}`}
              >
                Apply for this plan
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
