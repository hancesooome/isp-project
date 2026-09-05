import { useEffect, useState } from 'react'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { useAuth } from '../auth/auth-context'

interface Plan {
  id: string
  name: string
  description: string | null
  speed_mbps: number | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
}

interface AlternativePlan extends Plan {
  change_type: 'upgrade' | 'downgrade'
}

interface ChangeOptions {
  current_plan: Plan
  alternatives: AlternativePlan[]
}

const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function isPlan(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) return false
  const plan = value as Record<string, unknown>
  return typeof plan.id === 'string' && typeof plan.name === 'string' &&
    (typeof plan.description === 'string' || plan.description === null) &&
    (typeof plan.speed_mbps === 'number' || plan.speed_mbps === null) &&
    typeof plan.price_cents === 'number' &&
    (plan.billing_interval === 'monthly' || plan.billing_interval === 'yearly')
}

function isChangeOptions(value: unknown): value is ChangeOptions {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return isPlan(result.current_plan) && Array.isArray(result.alternatives) &&
    result.alternatives.every((plan) => isPlan(plan) && 'change_type' in plan &&
      (plan.change_type === 'upgrade' || plan.change_type === 'downgrade'))
}

export function ChangePlanPage() {
  const { session } = useAuth()
  const [options, setOptions] = useState<ChangeOptions | null>()
  const [selectedPlan, setSelectedPlan] = useState<AlternativePlan | null>(null)
  const [confirmedPlan, setConfirmedPlan] = useState<AlternativePlan | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadOptions() {
      try {
        const response = await fetch('/api/subscription/change-options', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error()
        const result: unknown = await response.json()
        if (!isChangeOptions(result)) throw new Error()
        setOptions(result)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load plan-change options. Please try again later.')
      }
    }
    void loadOptions()
    return () => controller.abort()
  }, [session])

  if (error) return <ErrorPanel message={error} title="Plan options unavailable" />
  if (options === undefined) return <PageSkeleton count={3} type="list" />
  if (options === null) return <EmptyState description="An active subscription is required before changing plans." title="No active subscription" />

  return (
    <section className="w-full">
      <header>
        <p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase">Subscription</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Change your plan</h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">Compare plans available at your installation location. Your current service stays unchanged until an approved change takes effect.</p>
      </header>

      <article className="mt-8 rounded-[16px] border border-blue-200 bg-blue-50 p-6">
        <p className="text-xs font-semibold tracking-[0.1em] text-blue-700 uppercase">Current plan</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-2xl font-semibold text-slate-950">{options.current_plan.name}</h2><p className="mt-2 text-sm text-slate-600">{speedLabel(options.current_plan)} · {options.current_plan.description ?? 'Internet service plan'}</p></div>
          <Price plan={options.current_plan} />
        </div>
      </article>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-slate-950">Available alternatives</h2>
        {options.alternatives.length === 0 ? <EmptyState className="mt-4" description="There are no other active plans assigned to your service area." title="No alternative plans" /> : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {options.alternatives.map((plan) => (
              <article className="flex flex-col rounded-[16px] border border-slate-900/10 bg-white p-6 shadow-[0_14px_40px_rgba(18,25,38,0.06)]" key={plan.id}>
                <div className="flex items-start justify-between gap-3"><div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${plan.change_type === 'upgrade' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{plan.change_type}</span><h3 className="mt-4 text-xl font-semibold text-slate-950">{plan.name}</h3></div><Price plan={plan} /></div>
                <p className="mt-4 font-medium text-slate-800">{speedLabel(plan)}</p>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{plan.description ?? 'Reliable internet service for your home.'}</p>
                <button className="mt-6 min-h-11 rounded-[10px] border border-slate-900 bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => { setSelectedPlan(plan); setAcknowledged(false); setConfirmedPlan(null) }} type="button">Review change</button>
              </article>
            ))}
          </div>
        )}
      </div>

      {confirmedPlan ? <p className="mt-6 rounded-[12px] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900" role="status">You reviewed {confirmedPlan.name}. Your current plan has not changed; request submission will be enabled by the upcoming validated workflow.</p> : null}

      {selectedPlan ? (
        <div aria-labelledby="change-review-title" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4" role="dialog">
          <div className="w-full max-w-xl rounded-[18px] bg-white p-6 shadow-2xl sm:p-8">
            <p className="text-xs font-semibold tracking-[0.12em] text-blue-700 uppercase">Review change</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950" id="change-review-title">{options.current_plan.name} → {selectedPlan.name}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><ComparisonCard label="Current" plan={options.current_plan} /><ComparisonCard label="Requested" plan={selectedPlan} /></div>
            <div className="mt-5 rounded-[10px] bg-slate-100 p-4 text-sm leading-6 text-slate-700"><strong>Expected timing:</strong> after review, an approved change is expected at the start of your next billing cycle. There is no immediate switch or mid-cycle proration.</div>
            <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-700"><input checked={acknowledged} className="mt-1" onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" /><span>I understand this review does not instantly change my current service.</span></label>
            <div className="mt-6 flex gap-3"><button className="min-h-11 flex-1 rounded-[10px] border border-slate-900/15 font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSelectedPlan(null)} type="button">Cancel</button><button className="min-h-11 flex-1 rounded-[10px] bg-slate-950 font-semibold text-white disabled:opacity-40" disabled={!acknowledged} onClick={() => { setConfirmedPlan(selectedPlan); setSelectedPlan(null) }} type="button">Confirm plan choice</button></div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Price({ plan }: { plan: Plan }) {
  return <p className="text-right text-xl font-semibold text-slate-950">{priceFormatter.format(plan.price_cents / 100)}<span className="block text-xs font-normal text-slate-500">per {plan.billing_interval === 'monthly' ? 'month' : 'year'}</span></p>
}

function ComparisonCard({ label, plan }: { label: string; plan: Plan }) {
  return <div className="rounded-[10px] border border-slate-900/10 p-4"><p className="text-xs font-semibold text-slate-500 uppercase">{label}</p><p className="mt-2 font-semibold text-slate-950">{plan.name}</p><p className="mt-1 text-sm text-slate-600">{speedLabel(plan)}</p><div className="mt-3"><Price plan={plan} /></div></div>
}

function speedLabel(plan: Plan) {
  return plan.speed_mbps === null ? 'Speed not specified' : `Up to ${plan.speed_mbps} Mbps`
}
