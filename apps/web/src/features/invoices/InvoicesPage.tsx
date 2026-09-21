import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { useAuth } from '../auth/auth-context'
import { moneyFormatter as priceFormatter } from '../../lib/money'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { CustomerPageHeader } from '../account/CustomerPageHeader'

interface Invoice {
  id: string
  amount_cents: number
  due_date: string
  status: 'open' | 'paid' | 'overdue'
  billing_period_start: string
  billing_period_end: string
  created_at: string
}

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
      <CustomerPageHeader description="Review your invoice amounts, due dates, and payment status." eyebrow="Billing" title="Your invoices" />

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
          <div className="overflow-hidden rounded-[18px] border border-slate-900/8 bg-white shadow-[0_18px_50px_rgba(18,25,38,0.05)]">
            {invoices.map((invoice) => (
              <article
                className="border-b border-slate-900/8 p-5 last:border-b-0 sm:p-6"
                key={invoice.id}
              >
                <div className="grid gap-4 sm:grid-cols-4 sm:items-center">
                  <div>
                    <p className="text-xs text-slate-500">Invoice</p>
                    <p className="mt-1 font-mono font-semibold text-slate-950">
                      #{invoice.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {priceFormatter.format(invoice.amount_cents / 100)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Due date</p>
                    <p className="mt-1 text-slate-800">
                      {dateFormatter.format(new Date(`${invoice.due_date}T00:00:00`))}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <StatusBadge status={invoice.status} />
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-900/8 pt-4">
                  <Link
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    to={`/account/invoices/${encodeURIComponent(invoice.id)}`}
                  >
                    View details <ArrowRight aria-hidden="true" size={16} />
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
