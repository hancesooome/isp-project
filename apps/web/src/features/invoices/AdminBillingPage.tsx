import { type FormEvent, useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'

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
    <section className="w-full max-w-3xl">
      <header>
        <a className="text-sm text-sky-400 hover:text-sky-300" href="/admin">
          Back to admin
        </a>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Admin billing
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          Create an invoice
        </h1>
        <p className="mt-3 text-slate-400">
          Manually create an open invoice for a current customer subscription.
        </p>
      </header>

      <form className="mt-8 space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8" noValidate onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="subscriptionId">
            Customer subscription
          </label>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-sky-400"
            disabled={subscriptions === null || loadError !== null}
            id="subscriptionId"
            onChange={(event) => updateField('subscriptionId', event.target.value)}
            value={values.subscriptionId}
          >
            <option value="">Select a subscription</option>
            {subscriptions?.map((subscription) => (
              <option key={subscription.id} value={subscription.id}>
                {subscription.customer?.full_name ?? 'Unnamed customer'} — {subscription.plan?.name ?? 'Unknown plan'} ({subscription.status.replace('_', ' ')})
              </option>
            ))}
          </select>
          {subscriptions === null && !loadError ? <p className="mt-2 text-sm text-slate-400" role="status">Loading subscriptions...</p> : null}
          {subscriptions?.length === 0 ? <p className="mt-2 text-sm text-slate-400">No current subscriptions are available.</p> : null}
          {loadError ? <p className="mt-2 text-sm text-red-300" role="alert">{loadError}</p> : null}
        </div>

        <Field id="amountCents" label="Amount (cents)" min="0" onChange={(value) => updateField('amountCents', value)} type="number" value={values.amountCents} />
        <Field id="dueDate" label="Due date" onChange={(value) => updateField('dueDate', value)} type="date" value={values.dueDate} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="billingPeriodStart" label="Billing period starts" onChange={(value) => updateField('billingPeriodStart', value)} type="date" value={values.billingPeriodStart} />
          <Field id="billingPeriodEnd" label="Billing period ends" onChange={(value) => updateField('billingPeriodEnd', value)} type="date" value={values.billingPeriodEnd} />
        </div>

        {formError ? <p className="text-sm text-red-300" role="alert">{formError}</p> : null}
        {success ? <p className="text-sm text-emerald-300" role="status">{success}</p> : null}

        <button
          className="w-full rounded-lg bg-sky-500 px-4 py-3 font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || subscriptions === null || subscriptions.length === 0 || loadError !== null}
          type="submit"
        >
          {isSubmitting ? 'Creating invoice...' : 'Create invoice'}
        </button>
      </form>
    </section>
  )
}

interface FieldProps {
  id: keyof FormValues
  label: string
  min?: string
  onChange: (value: string) => void
  type: 'date' | 'number'
  value: string
}

function Field({ id, label, min, onChange, type, value }: FieldProps) {
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
    </div>
  )
}
