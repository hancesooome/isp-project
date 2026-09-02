import { type FormEvent, useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

interface AdminSubscription {
  id: string
  status: 'active' | 'past_due'
  customer: { id: string; full_name: string | null } | null
  plan: { id: string; name: string } | null
}

interface FormValues {
  subscriptionId: string
  amountCents: string
  dueDate: string
  billingPeriodStart: string
  billingPeriodEnd: string
}

const initialValues: FormValues = {
  subscriptionId: '',
  amountCents: '',
  dueDate: '',
  billingPeriodStart: '',
  billingPeriodEnd: '',
}

function isAdminSubscription(value: unknown): value is AdminSubscription {
  if (typeof value !== 'object' || value === null) return false

  const subscription = value as Record<string, unknown>
  const customer = subscription.customer
  const plan = subscription.plan

  return (
    typeof subscription.id === 'string' &&
    (subscription.status === 'active' || subscription.status === 'past_due') &&
    (customer === null ||
      (typeof customer === 'object' &&
        customer !== null &&
        'id' in customer &&
        typeof customer.id === 'string' &&
        'full_name' in customer &&
        (typeof customer.full_name === 'string' ||
          customer.full_name === null))) &&
    (plan === null ||
      (typeof plan === 'object' &&
        plan !== null &&
        'id' in plan &&
        typeof plan.id === 'string' &&
        'name' in plan &&
        typeof plan.name === 'string'))
  )
}

export function AdminBillingPage() {
  const { session } = useAuth()
  const [subscriptions, setSubscriptions] = useState<
    AdminSubscription[] | null
  >(null)
  const [values, setValues] = useState(initialValues)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadSubscriptions() {
      try {
        const response = await fetch('/api/admin/subscriptions', {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) throw new Error('SUBSCRIPTIONS_REQUEST_FAILED')

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('subscriptions' in result) ||
          !Array.isArray(result.subscriptions) ||
          !result.subscriptions.every(isAdminSubscription)
        ) {
          throw new Error('INVALID_SUBSCRIPTIONS_RESPONSE')
        }

        setSubscriptions(result.subscriptions)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setLoadError('We could not load customer subscriptions.')
      }
    }

    void loadSubscriptions()
    return () => controller.abort()
  }, [session])

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setFormError(null)
    setSuccess(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amountCents = Number(values.amountCents)

    if (!values.subscriptionId) {
      setFormError('Select a customer subscription.')
      return
    }

    if (
      !/^\d+$/.test(values.amountCents) ||
      !Number.isSafeInteger(amountCents) ||
      amountCents > 2_147_483_647
    ) {
      setFormError('Enter a valid non-negative amount in cents.')
      return
    }

    if (!values.dueDate) {
      setFormError('Select a valid due date.')
      return
    }

    if (!values.billingPeriodStart || !values.billingPeriodEnd) {
      setFormError('Select the billing period dates.')
      return
    }

    if (values.billingPeriodEnd <= values.billingPeriodStart) {
      setFormError('Billing period end must be after its start.')
      return
    }

    if (!session || isSubmitting) return

    setFormError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: values.subscriptionId,
          amount_cents: amountCents,
          due_date: values.dueDate,
          billing_period_start: values.billingPeriodStart,
          billing_period_end: values.billingPeriodEnd,
        }),
      })

      if (!response.ok) {
        const result: unknown = await response.json()
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'We could not create this invoice.'

        setFormError(message)
        return
      }

      setSuccess('Invoice created successfully.')
      setValues(initialValues)
    } catch {
      setFormError('We could not create this invoice. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="w-full max-w-6xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
          Admin / Billing
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
          Create an invoice
        </h1>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          Manually create an open invoice for a current customer subscription.
        </p>
      </header>

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <form
            className="overflow-hidden rounded-[14px] border border-white/10 bg-[rgba(17,22,31,0.88)] shadow-[0_16px_45px_rgba(0,0,0,0.18)]"
            noValidate
            onSubmit={handleSubmit}
          >
            <div className="flex items-center gap-4 border-b border-white/8 px-5 py-5 sm:px-6">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-blue-400/20 bg-blue-500/12 text-blue-300">
                <svg className="h-5 w-5 text-blue-300" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <div>
                <h2 className="font-semibold text-white">Invoice details</h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  Enter the billing information below.
                </p>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
        <div>
          <label
            className="mb-2 block text-sm font-medium text-slate-200"
            htmlFor="subscriptionId"
          >
            Customer subscription
          </label>
          <select
            className="min-h-11 w-full rounded-[10px] border border-white/10 bg-[#0a0d12] px-3.5 text-sm text-white outline-none transition hover:border-white/15 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={subscriptions === null || loadError !== null}
            id="subscriptionId"
            onChange={(event) =>
              updateField('subscriptionId', event.target.value)
            }
            value={values.subscriptionId}
          >
            <option value="">Select a subscription</option>
            {subscriptions?.map((subscription) => (
              <option key={subscription.id} value={subscription.id}>
                {subscription.customer?.full_name ?? 'Unnamed customer'} — {subscription.plan?.name ?? 'Unknown plan'} ({subscription.status.replace('_', ' ')})
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Choose the current customer subscription to bill.
          </p>
          {subscriptions === null && !loadError ? (
            <p className="mt-2 text-sm text-slate-400" role="status">
              Loading subscriptions...
            </p>
          ) : null}
          {subscriptions?.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">
              No current subscriptions are available.
            </p>
          ) : null}
          {loadError ? (
            <p className="mt-2 text-sm text-red-300" role="alert">
              {loadError}
            </p>
          ) : null}
        </div>

        <Field
          help="Enter the amount in the smallest currency unit, without decimals."
          id="amountCents"
          label="Amount (cents)"
          min="0"
          onChange={(value) => updateField('amountCents', value)}
          type="number"
          value={values.amountCents}
        />
        <Field
          help="The date when payment becomes due."
          id="dueDate"
          label="Due date"
          onChange={(value) => updateField('dueDate', value)}
          type="date"
          value={values.dueDate}
        />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-200">
            Billing period
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="billingPeriodStart"
              label="Starts"
              onChange={(value) => updateField('billingPeriodStart', value)}
              type="date"
              value={values.billingPeriodStart}
            />
            <Field
              id="billingPeriodEnd"
              label="Ends"
              onChange={(value) => updateField('billingPeriodEnd', value)}
              type="date"
              value={values.billingPeriodEnd}
            />
          </div>
        </fieldset>

        {formError ? <p className="text-sm text-red-300" role="alert">{formError}</p> : null}
        {success ? <p className="text-sm text-emerald-300" role="status">{success}</p> : null}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || subscriptions === null || subscriptions.length === 0 || loadError !== null}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Creating invoice...</span>
            </>
          ) : (
            <span>Create invoice</span>
          )}
        </button>
      </div>
    </form>
    </div>
  </div>
</section>
  )
}

interface FieldProps {
  id: keyof FormValues
  label: string
  help?: string
  min?: string
  onChange: (value: string) => void
  type: 'date' | 'number'
  value: string
}

function Field({ id, label, help, min, onChange, type, value }: FieldProps) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor={id}>{label}</label>
      <input
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-sky-400"
        id={id}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        step={type === 'number' ? '1' : undefined}
        type={type}
        value={value}
      />
      {help ? <p className="mt-2 text-xs text-slate-400">{help}</p> : null}
    </div>
  )
}
