import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

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
  if (typeof value !== 'object' || value === null) {
    return false
  }

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

export function InvoicesPage() {
  const { session } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      return
    }

    const controller = new AbortController()

    async function loadInvoices() {
      try {
        const response = await fetch('/api/invoices', {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('INVOICES_REQUEST_FAILED')
        }

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('invoices' in result) ||
          !Array.isArray(result.invoices) ||
          !result.invoices.every(isInvoice)
        ) {
          throw new Error('INVALID_INVOICES_RESPONSE')
        }

        setInvoices(result.invoices)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load your invoices. Please try again later.')
      }
    }

    void loadInvoices()
    return () => controller.abort()
  }, [session])

  return (
    <section className="w-full max-w-5xl">
      <header>
        <Link className="text-sm font-medium text-sky-400 hover:text-sky-300" to="/account">
          Back to account
        </Link>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Billing
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Your invoices
        </h1>
        <p className="mt-2 text-slate-400">
          Review your invoice amounts, due dates, and payment status.
        </p>
      </header>

      {error ? (
        <p
          className="mt-8 rounded-xl border border-red-900 bg-red-950/50 p-5 text-center text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : invoices === null ? (
        <p className="mt-8 text-slate-300" role="status">
          Loading your invoices...
        </p>
      ) : invoices.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
          <h2 className="text-xl font-bold text-white">No invoices yet</h2>
          <p className="mt-2 text-slate-400">
            Your invoices will appear here when they are created.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {invoices.map((invoice) => (
            <article
              className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6"
              key={invoice.id}
            >
              <div className="grid gap-4 sm:grid-cols-4 sm:items-center">
                <div>
                  <p className="text-sm text-slate-400">Invoice</p>
                  <p className="mt-1 font-mono font-semibold text-white">
                    #{invoice.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Amount</p>
                  <p className="mt-1 font-semibold text-white">
                    {priceFormatter.format(invoice.amount_cents / 100)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Due date</p>
                  <p className="mt-1 text-white">
                    {dateFormatter.format(new Date(`${invoice.due_date}T00:00:00`))}
                  </p>
                </div>
                <div className="sm:text-right">
                  <span
                    className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold capitalize ${statusStyles[invoice.status]}`}
                  >
                    {invoice.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-800 pt-4">
                <Link
                  className="font-medium text-sky-400 hover:text-sky-300"
                  to={`/account/invoices/${encodeURIComponent(invoice.id)}`}
                >
                  View details
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
