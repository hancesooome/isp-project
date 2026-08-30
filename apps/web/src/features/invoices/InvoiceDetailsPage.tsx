import { useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'

interface Invoice {
  id: string
  amount_cents: number
  due_date: string
  status: 'open' | 'paid' | 'overdue'
  billing_period_start: string
  billing_period_end: string
  created_at: string
}

interface InvoiceDetailsPageProps {
  invoiceId: string
}

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
})

const statusStyles = {
  open: 'border-amber-700 bg-amber-950/50 text-amber-200',
  paid: 'border-emerald-700 bg-emerald-950/50 text-emerald-200',
  overdue: 'border-red-800 bg-red-950/50 text-red-200',
}

function isInvoice(value: unknown): value is Invoice {
  if (typeof value !== 'object' || value === null) return false

  const invoice = value as Record<string, unknown>

  return (
    typeof invoice.id === 'string' &&
    typeof invoice.amount_cents === 'number' &&
    typeof invoice.due_date === 'string' &&
    (invoice.status === 'open' ||
      invoice.status === 'paid' ||
      invoice.status === 'overdue') &&
    typeof invoice.billing_period_start === 'string' &&
    typeof invoice.billing_period_end === 'string' &&
    typeof invoice.created_at === 'string'
  )
}

export function InvoiceDetailsPage({ invoiceId }: InvoiceDetailsPageProps) {
  const { session } = useAuth()
  const [invoice, setInvoice] = useState<Invoice | null>()
  const [error, setError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadInvoice() {
      try {
        const response = await fetch(
          `/api/invoices/${encodeURIComponent(invoiceId)}`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            signal: controller.signal,
          },
        )

        if (response.status === 404) {
          setInvoice(null)
          return
        }

        if (!response.ok) throw new Error('INVOICE_REQUEST_FAILED')

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('invoice' in result) ||
          !isInvoice(result.invoice)
        ) {
          throw new Error('INVALID_INVOICE_RESPONSE')
        }

        setInvoice(result.invoice)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load this invoice. Please try again later.')
      }
    }

    void loadInvoice()
    return () => controller.abort()
  }, [invoiceId, session])

  async function handlePayNow() {
    if (!session || !invoice || isRedirecting) return

    setCheckoutError(null)
    setIsRedirecting(true)

    try {
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(invoice.id)}/checkout-session`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      )

      if (!response.ok) throw new Error('CHECKOUT_REQUEST_FAILED')

      const result: unknown = await response.json()

      if (
        typeof result !== 'object' ||
        result === null ||
        !('checkout_url' in result) ||
        typeof result.checkout_url !== 'string'
      ) {
        throw new Error('INVALID_CHECKOUT_RESPONSE')
      }

      const checkoutUrl = new URL(result.checkout_url)

      if (checkoutUrl.protocol !== 'https:') {
        throw new Error('INVALID_CHECKOUT_URL')
      }

      window.location.assign(checkoutUrl.toString())
    } catch {
      setCheckoutError('We could not start checkout. Please try again later.')
      setIsRedirecting(false)
    }
  }

  if (error) {
    return (
      <p className="w-full max-w-2xl rounded-xl border border-red-900 bg-red-950/50 p-5 text-center text-red-200" role="alert">
        {error}
      </p>
    )
  }

  if (invoice === undefined) return <p role="status">Loading invoice...</p>

  if (invoice === null) {
    return (
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="text-3xl font-bold text-white">Invoice not found</h1>
        <p className="mt-3 text-slate-400">
          This invoice does not exist or is not available to your account.
        </p>
        <a className="mt-6 inline-block font-medium text-sky-400 hover:text-sky-300" href="/account/invoices">
          Back to invoices
        </a>
      </section>
    )
  }

  return (
    <section className="w-full max-w-2xl">
      <a className="text-sm font-medium text-sky-400 hover:text-sky-300" href="/account/invoices">
        Back to invoices
      </a>

      <article className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
              Invoice details
            </p>
            <h1 className="mt-3 font-mono text-2xl font-bold text-white sm:text-3xl">
              #{invoice.id.slice(0, 8).toUpperCase()}
            </h1>
          </div>
          <span className={`rounded-full border px-3 py-1 text-sm font-semibold capitalize ${statusStyles[invoice.status]}`}>
            {invoice.status}
          </span>
        </div>

        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          <Detail label="Amount" value={priceFormatter.format(invoice.amount_cents / 100)} />
          <Detail label="Due date" value={formatDatabaseDate(invoice.due_date)} />
          <Detail label="Billing period starts" value={formatDatabaseDate(invoice.billing_period_start)} />
          <Detail label="Billing period ends" value={formatDatabaseDate(invoice.billing_period_end)} />
          <Detail label="Created" value={dateFormatter.format(new Date(invoice.created_at))} />
          <div>
            <dt className="text-sm text-slate-400">Invoice ID</dt>
            <dd className="mt-1 break-all font-mono text-sm text-white">{invoice.id}</dd>
          </div>
        </dl>

        {invoice.status === 'open' && invoice.amount_cents > 0 ? (
          <div className="mt-8 border-t border-slate-800 pt-6">
            {checkoutError ? (
              <p className="mb-4 text-sm text-red-300" role="alert">
                {checkoutError}
              </p>
            ) : null}
            <button
              className="w-full rounded-lg bg-sky-500 px-4 py-3 font-semibold text-slate-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isRedirecting}
              onClick={() => void handlePayNow()}
              type="button"
            >
              {isRedirecting ? 'Opening secure checkout...' : 'Pay now'}
            </button>
            <p className="mt-3 text-center text-sm text-slate-400">
              You will be redirected to Stripe&apos;s secure checkout.
            </p>
          </div>
        ) : null}
      </article>
    </section>
  )
}

function formatDatabaseDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-white">{value}</dd>
    </div>
  )
}
