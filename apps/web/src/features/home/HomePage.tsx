import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { moneyFormatter as priceFormatter } from '../../lib/money'

interface Plan {
  id: string
  name: string
  description: string | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
}

const benefits = [
  ['01', 'Start with your address', 'Check service availability before choosing the plan that fits your home.'],
  ['02', 'Apply with clarity', 'Select an active plan, submit your application online, and follow its status.'],
  ['03', 'Manage service online', 'Access your plan, invoices, payments, and available statements from one account.'],
]

const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

function isPlan(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) return false
  const plan = value as Record<string, unknown>
  return typeof plan.id === 'string' && typeof plan.name === 'string' &&
    (typeof plan.description === 'string' || plan.description === null) &&
    typeof plan.price_cents === 'number' &&
    (plan.billing_interval === 'monthly' || plan.billing_interval === 'yearly')
}

export function HomePage() {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [plansError, setPlansError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function loadPlans() {
      try {
        const response = await fetch('/api/plans', { signal: controller.signal })
        if (!response.ok) throw new Error('PLANS_REQUEST_FAILED')
        const result: unknown = await response.json()
        if (typeof result !== 'object' || result === null || !('plans' in result) ||
          !Array.isArray(result.plans) || !result.plans.every(isPlan)) {
          throw new Error('INVALID_PLANS_RESPONSE')
        }
        setPlans(result.plans)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setPlansError(true)
      }
    }
    void loadPlans()
    return () => controller.abort()
  }, [])

  return (
    <div className="overflow-hidden">

      <div>
        <section className="public-hero-grid relative min-h-[760px] border-b border-slate-900/10 px-5 pb-16 pt-16 sm:px-8 sm:pt-24 lg:min-h-[800px] lg:px-10">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            <div className="relative z-10 max-w-3xl">
              <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Connected living, made simple</p>
              <h1 className="mt-5 max-w-3xl text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
                Internet built for <span className="public-accent-text">everything that matters.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Find available service, choose an active plan, and manage your ISP account through one clear online experience.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link className={`public-primary-button inline-flex min-h-12 items-center justify-center rounded-[10px] px-6 text-sm font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 ${focusClass}`} to="/availability">Check availability <span aria-hidden="true" className="ml-2">→</span></Link>
                <Link className={`inline-flex min-h-12 items-center justify-center rounded-[10px] border border-slate-900/12 bg-white/75 px-6 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white ${focusClass}`} to="/plans">View plans</Link>
              </div>
              <p className="mt-4 text-sm text-slate-500">Start with the address where you want service installed.</p>
            </div>
            <div aria-hidden="true" className="public-signal-art relative mx-auto h-[320px] w-full max-w-xl sm:h-[400px] lg:h-[520px]">
              <div className="public-router"><span className="public-router-light" /></div>
              <span className="public-signal public-signal-one" /><span className="public-signal public-signal-two" /><span className="public-signal public-signal-three" />
              <div className="public-service-note"><span className="public-service-dot" /><span><strong>Ready when you are</strong><small>Check your service address online</small></span></div>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-10" id="why-isp">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 border-b border-slate-900/10 pb-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div><p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">A clearer way to connect</p><h2 className="mt-4 max-w-lg text-3xl leading-tight font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">From availability check to account access.</h2></div>
              <p className="max-w-2xl text-base leading-7 text-slate-600 lg:justify-self-end">The service journey stays straightforward: confirm your location, review real plan options, apply, and return to your account when you need it.</p>
            </div>
            <ol className="grid md:grid-cols-3">
              {benefits.map(([number, title, description]) => (
                <li className="border-b border-slate-900/10 py-9 md:border-r md:border-b-0 md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0" key={number}>
                  <span className="text-sm font-semibold text-blue-600">{number}</span><h3 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-slate-950">{title}</h3><p className="mt-3 max-w-sm leading-7 text-slate-600">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y border-slate-900/10 bg-[#f7f8fb] px-5 py-20 sm:px-8 sm:py-24 lg:px-10" aria-labelledby="plans-heading">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">Internet plans</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl" id="plans-heading">Choose your connection.</h2><p className="mt-3 max-w-xl leading-7 text-slate-600">Review currently active plans, then check availability for your address.</p></div>
              <Link className={`text-sm font-semibold text-slate-950 underline decoration-slate-300 underline-offset-8 transition hover:decoration-blue-500 ${focusClass}`} to="/plans">Compare all plans →</Link>
            </div>
            <div className="mt-12">
              {plansError ? (
                <div className="flex flex-col gap-4 border-y border-slate-900/10 py-8 sm:flex-row sm:items-center sm:justify-between" role="status"><p className="text-slate-600">Plan details are unavailable right now.</p><Link className={`text-sm font-semibold text-blue-700 ${focusClass}`} to="/plans">Open plans page →</Link></div>
              ) : plans === null ? (
                <div aria-label="Loading plans" className="grid gap-px overflow-hidden rounded-[14px] border border-slate-900/10 bg-slate-900/10 md:grid-cols-3" role="status">{[0, 1, 2].map((item) => <div className="h-64 animate-pulse bg-white/80" key={item} />)}</div>
              ) : plans.length === 0 ? (
                <div className="border-y border-slate-900/10 py-8 text-slate-600">No active plans are available to preview right now.</div>
              ) : (
                <div className="grid gap-px overflow-hidden rounded-[14px] border border-slate-900/10 bg-slate-900/10 shadow-[0_18px_50px_rgba(18,25,38,0.06)] md:grid-cols-3">
                  {plans.slice(0, 3).map((plan) => (
                    <article className="flex min-h-72 flex-col bg-white p-7 sm:p-8" key={plan.id}>
                      <h3 className="text-xl font-semibold text-slate-950">{plan.name}</h3><p className="mt-3 line-clamp-2 min-h-12 leading-6 text-slate-600">{plan.description ?? 'Internet service for your home.'}</p><p className="mt-7 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{priceFormatter.format(plan.price_cents / 100)}</p><p className="mt-1 text-sm text-slate-500">per {plan.billing_interval === 'monthly' ? 'month' : 'year'}</p>
                      <Link className={`mt-auto inline-flex min-h-11 items-center justify-center rounded-[10px] border border-slate-900/12 px-4 text-sm font-semibold text-slate-950 transition hover:border-slate-900 hover:bg-slate-950 hover:text-white ${focusClass}`} to={`/availability?plan=${encodeURIComponent(plan.id)}`}>Check this plan</Link>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="public-coverage-panel mx-auto grid max-w-7xl overflow-hidden rounded-[18px] bg-slate-950 text-white lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="p-8 sm:p-12 lg:p-14"><p className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">Service availability</p><h2 className="mt-4 max-w-2xl text-3xl leading-tight font-semibold tracking-[-0.035em] sm:text-4xl">See what is available at your address.</h2><p className="mt-4 max-w-xl leading-7 text-slate-300">Enter your installation address in the existing availability flow to begin.</p></div>
            <div className="border-t border-white/10 p-8 sm:p-12 lg:border-t-0 lg:border-l lg:p-14"><Link className={`public-primary-button inline-flex min-h-12 w-full items-center justify-center rounded-[10px] px-6 text-sm font-semibold text-white transition hover:brightness-110 lg:w-auto ${focusClass}`} to="/availability">Check availability →</Link></div>
          </div>
        </section>
      </div>

    </div>
  )
}
