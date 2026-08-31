import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'

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
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Billing
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Your invoices
        </h1>
        <p className="mt-2 text-slate-400">
          Review your invoice amounts, due dates, and payment status.
        </p>
      </header>

      <div className="mt-8">
        {error ? (
          <ErrorPanel message={error} title="Invoices unavailable" />
        ) : invoices === null ? (
          <PageSkeleton count={3} type="list" />
        ) : invoices.length === 0 ? (
          <EmptyState
            description="Your invoices will appear here when they are generated."
            title="No invoices yet"
          />
        ) : (
          <div className="space-y-4">
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
                    <StatusBadge status={invoice.status} />
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-800 pt-4">
                  <Link
                    className="font-medium text-sky-400 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                    to={`/account/invoices/${encodeURIComponent(invoice.id)}`}
                  >
                    View details &rarr;
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
