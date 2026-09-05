import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { moneyFormatter as priceFormatter } from '../../lib/money'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
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

interface InvoiceDetailsPageProps {
  invoiceId: string
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
})

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
  const [searchParams] = useSearchParams()
  const checkoutOutcome = searchParams.get('checkout')
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
    return <ErrorPanel message={error} title="Invoice unavailable" />
  }

  if (invoice === undefined) {
    return <PageSkeleton type="detail" />
  }

  if (invoice === null) {
    return (
      <EmptyState
        action={
          <Link
            className="inline-block font-medium text-sky-400 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
            to="/account/invoices"
          >
            &larr; Back to invoices
          </Link>
        }
        description="This invoice does not exist or is not available to your account."
        title="Invoice not found"
      />
    )
  }

  return (
    <section className="w-full max-w-2xl">
      <Link
        className="text-sm font-medium text-sky-400 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
        to="/account/invoices"
      >
        &larr; Back to invoices
      </Link>

      <article className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
        {checkoutOutcome === 'canceled' ? (
          <p
            className="mb-6 rounded-lg border border-amber-800 bg-amber-950/50 p-4 text-sm text-amber-200"
            role="status"
          >
            Payment was canceled. Your invoice is still unpaid, and you can try
            again when you are ready.
          </p>
        ) : checkoutOutcome === 'success' && invoice.status !== 'paid' ? (
          <p
            className="mb-6 rounded-lg border border-sky-800 bg-sky-950/50 p-4 text-sm text-sky-200"
            role="status"
          >
            Your payment is being confirmed. This invoice will update after
            Stripe confirms the payment.
          </p>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
              Invoice details
            </p>
            <h1 className="mt-3 font-mono text-2xl font-bold text-white sm:text-3xl">
              #{invoice.id.slice(0, 8).toUpperCase()}
            </h1>
          </div>
          <StatusBadge status={invoice.status} />
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
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isRedirecting}
              onClick={() => void handlePayNow()}
              type="button"
            >
              {isRedirecting ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Opening secure checkout...</span>
                </>
              ) : (
                <span>Pay now</span>
              )}
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
