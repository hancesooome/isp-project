import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

interface AdminPlan {
  id: string
  name: string
  slug: string
  description: string | null
  speed_mbps: number | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
  is_active: boolean
  created_at: string
  updated_at: string
}

interface PlanFormState {
  name: string
  slug: string
  description: string
  speedMbps: string
  price: string
  billingInterval: 'monthly' | 'yearly'
}

const emptyForm: PlanFormState = {
  name: '',
  slug: '',
  description: '',
  speedMbps: '',
  price: '',
  billingInterval: 'monthly',
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
})

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isAdminPlan(value: unknown): value is AdminPlan {
  if (typeof value !== 'object' || value === null) return false

  const plan = value as Record<string, unknown>
  return (
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.slug === 'string' &&
    isNullableString(plan.description) &&
    (typeof plan.speed_mbps === 'number' || plan.speed_mbps === null) &&
    typeof plan.price_cents === 'number' &&
    (plan.billing_interval === 'monthly' || plan.billing_interval === 'yearly') &&
    typeof plan.is_active === 'boolean' &&
    typeof plan.created_at === 'string' &&
    typeof plan.updated_at === 'string'
  )
}

function sortPlans(plans: AdminPlan[]): AdminPlan[] {
  return [...plans].sort(
    (first, second) =>
      Number(second.is_active) - Number(first.is_active) ||
      first.price_cents - second.price_cents ||
      first.name.localeCompare(second.name),
  )
}

function parsePriceCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null

  const [whole, decimal = ''] = value.split('.')
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 2_147_483_647 ? cents : null
}

async function getResponseError(response: Response, fallback: string) {
  const result: unknown = await response.json().catch(() => null)
  return typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
    ? result.error
    : fallback
}

export function AdminPlansPage() {
  const { session } = useAuth()
  const [plans, setPlans] = useState<AdminPlan[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<PlanFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activationId, setActivationId] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadPlans() {
      try {
        const response = await fetch('/api/admin/plans', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('ADMIN_PLANS_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('plans' in result) ||
          !Array.isArray(result.plans) ||
          !result.plans.every(isAdminPlan)
        ) {
          throw new Error('INVALID_ADMIN_PLANS_RESPONSE')
        }

        setPlans(result.plans)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setLoadError('We could not load plans. Please try again later.')
      }
    }

    void loadPlans()
    return () => controller.abort()
  }, [session])

  function startEditing(plan: AdminPlan) {
    setEditingId(plan.id)
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? '',
      speedMbps: plan.speed_mbps?.toString() ?? '',
      price: (plan.price_cents / 100).toFixed(2),
      billingInterval: plan.billing_interval,
    })
    setFormError(null)
    setFormSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || isSaving) return

    const speedMbps = Number(form.speedMbps)
    const priceCents = parsePriceCents(form.price)

    if (
      !form.name.trim() ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) ||
      !Number.isInteger(speedMbps) ||
      speedMbps < 1 ||
      speedMbps > 100_000 ||
      priceCents === null
    ) {
      setFormError('Enter a valid name, lowercase slug, speed, and price.')
      return
    }

    setIsSaving(true)
    setFormError(null)
    setFormSuccess(null)

    try {
      const response = await fetch(
        editingId ? `/api/admin/plans/${encodeURIComponent(editingId)}` : '/api/admin/plans',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.name,
            slug: form.slug,
            description: form.description || null,
            speed_mbps: speedMbps,
            price_cents: priceCents,
            billing_interval: form.billingInterval,
          }),
        },
      )

      if (!response.ok) {
        setFormError(await getResponseError(response, 'We could not save this plan.'))
        return
      }

      const result: unknown = await response.json()
      if (
        typeof result !== 'object' ||
        result === null ||
        !('plan' in result) ||
        !isAdminPlan(result.plan)
      ) {
        throw new Error('INVALID_ADMIN_PLAN_RESPONSE')
      }

      const savedPlan = result.plan
      setPlans((current) =>
        sortPlans(
          current?.some((plan) => plan.id === savedPlan.id)
            ? current.map((plan) => (plan.id === savedPlan.id ? savedPlan : plan))
            : [...(current ?? []), savedPlan],
        ),
      )
      setFormSuccess(editingId ? 'Plan updated.' : 'Plan created.')
      setEditingId(null)
      setForm(emptyForm)
    } catch {
      setFormError('We could not save this plan. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleActivation(plan: AdminPlan) {
    if (!session || activationId) return

    setActivationId(plan.id)
    setFormSuccess(null)
    setFormError(null)

    try {
      const response = await fetch(
        `/api/admin/plans/${encodeURIComponent(plan.id)}/activation`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_active: !plan.is_active }),
        },
      )

      if (!response.ok) {
        setFormError(
          await getResponseError(response, 'We could not update plan availability.'),
        )
        return
      }

      const result: unknown = await response.json()
      if (
        typeof result !== 'object' ||
        result === null ||
        !('plan' in result) ||
        !isAdminPlan(result.plan)
      ) {
        throw new Error('INVALID_ADMIN_PLAN_RESPONSE')
      }

      const savedPlan = result.plan
      setPlans((current) =>
        sortPlans(
          (current ?? []).map((item) =>
            item.id === savedPlan.id ? savedPlan : item,
          ),
        ),
      )
      setFormSuccess(savedPlan.is_active ? 'Plan activated.' : 'Plan deactivated.')
    } catch {
      setFormError('We could not update plan availability. Please try again.')
    } finally {
      setActivationId(null)
    }
  }

  return (
    <section className="w-full max-w-6xl">
      <header>
        <p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Admin portal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">Plans</h1>
        <p className="mt-2 text-sm text-slate-400">Manage internet plan details and public availability.</p>
      </header>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 lg:order-1">
          {loadError ? (
            <ErrorPanel message={loadError} title="Plans unavailable" />
          ) : plans === null ? (
            <PageSkeleton count={4} type="list" />
          ) : plans.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-white/10 bg-[#11161f] p-8 text-center text-sm text-slate-400">No plans have been created yet.</div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <article className="rounded-[12px] border border-white/8 bg-[#11161f] p-5" key={plan.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="font-semibold text-white">{plan.name}</h2>
                        <StatusBadge status={plan.is_active ? 'active' : 'inactive'} />
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-500">{plan.slug}</p>
                    </div>
                    <p className="text-lg font-semibold text-white">{currencyFormatter.format(plan.price_cents / 100)}<span className="text-xs font-normal text-slate-500">/{plan.billing_interval === 'monthly' ? 'mo' : 'yr'}</span></p>
                  </div>
                  <p className="mt-4 text-sm text-slate-400">{plan.description ?? 'No description provided.'}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                    <p className="text-sm font-medium text-blue-200">{plan.speed_mbps ? `${plan.speed_mbps.toLocaleString()} Mbps` : 'Speed not set'}</p>
                    <div className="flex gap-2">
                      <button className="min-h-10 rounded-[9px] border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => startEditing(plan)} type="button">Edit</button>
                      <button
                        className="min-h-10 rounded-[9px] border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={activationId !== null}
                        onClick={() => void handleActivation(plan)}
                        type="button"
                      >
                        {activationId === plan.id ? 'Updating…' : plan.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="order-1 lg:order-2">
          <form className="rounded-[12px] border border-white/8 bg-[#11161f] p-5 lg:sticky lg:top-8" onSubmit={(event) => void handleSubmit(event)}>
            <h2 className="font-semibold text-white">{editingId ? 'Edit plan' : 'Create plan'}</h2>
            <div className="mt-5 space-y-4">
              <Field label="Name"><input className={inputClass} maxLength={100} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></Field>
              <Field label="Slug"><input className={inputClass} maxLength={100} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="fiber-300" required value={form.slug} /></Field>
              <Field label="Description"><textarea className={`${inputClass} min-h-24 resize-y`} maxLength={1000} onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Speed (Mbps)"><input className={inputClass} max={100000} min={1} onChange={(event) => setForm({ ...form, speedMbps: event.target.value })} required type="number" value={form.speedMbps} /></Field>
                <Field label="Price (PHP)"><input className={inputClass} inputMode="decimal" onChange={(event) => setForm({ ...form, price: event.target.value })} pattern="\d+(\.\d{1,2})?" placeholder="1499.00" required value={form.price} /></Field>
              </div>
              <Field label="Billing interval">
                <select className={inputClass} onChange={(event) => setForm({ ...form, billingInterval: event.target.value as 'monthly' | 'yearly' })} value={form.billingInterval}>
                  <option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                </select>
              </Field>
            </div>
            {formError ? <p className="mt-4 text-xs text-red-300" role="alert">{formError}</p> : null}
            {formSuccess ? <p className="mt-4 text-xs text-emerald-300" role="status">{formSuccess}</p> : null}
            <div className="mt-5 flex gap-2">
              <button className="min-h-11 flex-1 rounded-[9px] bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Create plan'}</button>
              {editingId ? <button className="min-h-11 rounded-[9px] border border-white/10 px-4 text-sm font-semibold text-slate-300 hover:bg-white/8" onClick={resetForm} type="button">Cancel</button> : null}
            </div>
          </form>
        </aside>
      </div>
    </section>
  )
}

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-[9px] border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25'

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="block text-xs font-medium text-slate-400">{label}{children}</label>
}
