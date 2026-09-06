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

type PaymentOption = 'card' | 'gcash' | 'maya' | 'qrph'
type PayMongoStatus =
  | 'expired_canceled_or_failed'
  | 'paid_awaiting_confirmation'
  | 'pending'

interface QrPayment {
  id: string
  imageUrl: string
  status: PayMongoStatus
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
})

const paymentMethodDetails: Record<
  PaymentOption,
  { label: string; description: string; logoSrc?: string; logoClassName?: string }
> = {
  gcash: { label: 'GCash', description: 'Continue in GCash to authorize payment' },
  maya: { label: 'Maya', description: 'Continue in Maya to authorize payment' },
  qrph: {
    label: 'QR Ph',
    description: 'Scan using a supported banking or wallet app',
    logoSrc: '/brands/qr-ph.webp',
    logoClassName: 'h-7 w-auto',
  },
  card: {
    label: 'Credit or debit card',
    description: 'Secure checkout powered by Stripe',
    logoSrc: '/brands/stripe-wordmark-slate.svg',
    logoClassName: 'h-7 w-auto',
  },
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
  const [searchParams] = useSearchParams()
  const checkoutOutcome = searchParams.get('checkout')
  const payMongoOutcome = searchParams.get('paymongo')
  const paymentIntentId = searchParams.get('payment_intent_id')
  const returnedWallet = searchParams.get('wallet') === 'maya' ? 'Maya' : 'GCash'
  const [invoice, setInvoice] = useState<Invoice | null>()
  const [error, setError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [redirectProvider, setRedirectProvider] = useState<PaymentOption | null>(null)
  const [payMongoReturnStatus, setPayMongoReturnStatus] = useState<
    'checking' | PayMongoStatus | null
  >(payMongoOutcome === 'returned' ? 'checking' : null)
  const [qrPayment, setQrPayment] = useState<QrPayment | null>(null)
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<
    PaymentOption[]
  >([])
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    PaymentOption | null
  >(null)

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

  useEffect(() => {
    if (!session) return

    const controller = new AbortController()

    async function loadPaymentMethods() {
      try {
        const response = await fetch('/api/payments/methods', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('PAYMENT_METHODS_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('methods' in result) ||
          !Array.isArray(result.methods) ||
          !result.methods.every(
            (method) =>
              method === 'card' ||
              method === 'gcash' ||
              method === 'maya' ||
              method === 'qrph',
          )
        ) {
          throw new Error('INVALID_PAYMENT_METHODS_RESPONSE')
        }

        const methods = result.methods as PaymentOption[]
        setAvailablePaymentMethods(methods)
        setSelectedPaymentMethod(methods[0] ?? null)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }
        setAvailablePaymentMethods([])
      } finally {
        if (!controller.signal.aborted) setPaymentMethodsLoading(false)
      }
    }

    void loadPaymentMethods()
    return () => controller.abort()
  }, [session])

  useEffect(() => {
    if (
      !session ||
      payMongoOutcome !== 'returned' ||
      !paymentIntentId
    ) return

    const controller = new AbortController()

    async function checkPaymentStatus() {
      try {
        const response = await fetch(
          `/api/invoices/${encodeURIComponent(invoiceId)}/paymongo/payment-intents/${encodeURIComponent(paymentIntentId ?? '')}/status`,
          {
            headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
            signal: controller.signal,
          },
        )
        if (!response.ok) throw new Error('PAYMENT_STATUS_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('outcome' in result) ||
          (result.outcome !== 'expired_canceled_or_failed' &&
            result.outcome !== 'paid_awaiting_confirmation' &&
            result.outcome !== 'pending')
        ) {
          throw new Error('INVALID_PAYMENT_STATUS_RESPONSE')
        }

        setPayMongoReturnStatus(result.outcome)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }
        setPayMongoReturnStatus('pending')
      }
    }

    void checkPaymentStatus()
    return () => controller.abort()
  }, [invoiceId, payMongoOutcome, paymentIntentId, session])

  useEffect(() => {
    if (!session || !qrPayment || qrPayment.status !== 'pending') return

    const controller = new AbortController()

    async function checkQrStatus() {
      try {
        const response = await fetch(
          `/api/invoices/${encodeURIComponent(invoiceId)}/paymongo/payment-intents/${encodeURIComponent(qrPayment?.id ?? '')}/status`,
          {
            headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
            signal: controller.signal,
          },
        )
        if (!response.ok) return

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('outcome' in result) ||
          (result.outcome !== 'expired_canceled_or_failed' &&
            result.outcome !== 'paid_awaiting_confirmation' &&
            result.outcome !== 'pending')
        ) return

        setQrPayment((current) => {
          if (!current || current.status === result.outcome) return current
          return { ...current, status: result.outcome as PayMongoStatus }
        })
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }
      }
    }

    void checkQrStatus()
    const interval = window.setInterval(() => void checkQrStatus(), 5_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [invoiceId, qrPayment, session])

  useEffect(() => {
    if (
      !session ||
      !payMongoReturnStatus ||
      payMongoReturnStatus === 'expired_canceled_or_failed' ||
      invoice?.status === 'paid'
    ) return

    const controller = new AbortController()

    async function refreshInvoice() {
      try {
        const response = await fetch(
          `/api/invoices/${encodeURIComponent(invoiceId)}`,
          {
            headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
            signal: controller.signal,
          },
        )
        if (!response.ok) return

        const result: unknown = await response.json()
        if (
          typeof result !== 'object' ||
          result === null ||
          !('invoice' in result) ||
          !isInvoice(result.invoice)
        ) return

        setInvoice(result.invoice)
        if (result.invoice.status === 'paid') {
          setPayMongoReturnStatus(null)
        }
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }
      }
    }

    const interval = window.setInterval(() => void refreshInvoice(), 3_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [invoice?.status, invoiceId, payMongoReturnStatus, session])

  async function handlePayNow() {
    if (!session || !invoice || isRedirecting) return

    setCheckoutError(null)
    setIsRedirecting(true)
    setRedirectProvider('card')

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
      setRedirectProvider(null)
    }
  }

  async function handleEwalletPayment(wallet: 'gcash' | 'maya') {
    if (!session || !invoice || isRedirecting) return

    setCheckoutError(null)
    setIsRedirecting(true)
    setRedirectProvider(wallet)

    try {
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(invoice.id)}/paymongo/${wallet}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      )

      if (!response.ok) throw new Error('EWALLET_REQUEST_FAILED')

      const result: unknown = await response.json()

      if (
        typeof result !== 'object' ||
        result === null ||
        !('redirect_url' in result) ||
        typeof result.redirect_url !== 'string'
      ) {
        throw new Error('INVALID_EWALLET_RESPONSE')
      }

      const redirectUrl = new URL(result.redirect_url)

      if (redirectUrl.protocol !== 'https:') {
        throw new Error('INVALID_EWALLET_REDIRECT')
      }

      window.location.assign(redirectUrl.toString())
    } catch {
      const walletName = wallet === 'maya' ? 'Maya' : 'GCash'
      setCheckoutError(`We could not open ${walletName}. Please try again later.`)
      setIsRedirecting(false)
      setRedirectProvider(null)
    }
  }

  async function handleQrPayment() {
    if (!session || !invoice || isRedirecting) return

    setCheckoutError(null)
    setIsRedirecting(true)
    setRedirectProvider('qrph')

    try {
      const response = await fetch(
        `/api/invoices/${encodeURIComponent(invoice.id)}/paymongo/qrph`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      )
      if (!response.ok) throw new Error('QRPH_REQUEST_FAILED')

      const result: unknown = await response.json()
      if (
        typeof result !== 'object' ||
        result === null ||
        !('payment_intent_id' in result) ||
        typeof result.payment_intent_id !== 'string' ||
        !('qr_image_url' in result) ||
        typeof result.qr_image_url !== 'string' ||
        !result.qr_image_url.startsWith('data:image/png;base64,')
      ) {
        throw new Error('INVALID_QRPH_RESPONSE')
      }

      setQrPayment({
        id: result.payment_intent_id,
        imageUrl: result.qr_image_url,
        status: 'pending',
      })
    } catch {
      setCheckoutError('We could not generate the QR Ph code. Please try again later.')
    } finally {
      setIsRedirecting(false)
      setRedirectProvider(null)
    }
  }

  function handleSelectedPayment() {
    if (selectedPaymentMethod === 'card') {
      void handlePayNow()
    } else if (
      selectedPaymentMethod === 'gcash' ||
      selectedPaymentMethod === 'maya'
    ) {
      void handleEwalletPayment(selectedPaymentMethod)
    } else if (selectedPaymentMethod === 'qrph') {
      void handleQrPayment()
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
        {payMongoReturnStatus === 'expired_canceled_or_failed' && invoice.status !== 'paid' ? (
          <p
            className="mb-6 rounded-lg border border-amber-800 bg-amber-950/50 p-4 text-sm text-amber-200"
            role="status"
          >
            The {returnedWallet} payment expired, was canceled, or could not be completed. Your
            invoice is still unpaid, and you can try again.
          </p>
        ) : payMongoReturnStatus && invoice.status !== 'paid' ? (
          <p
            className="mb-6 rounded-lg border border-sky-800 bg-sky-950/50 p-4 text-sm text-sky-200"
            role="status"
          >
            {payMongoReturnStatus === 'checking'
              ? `Checking your ${returnedWallet} payment status...`
              : payMongoReturnStatus === 'paid_awaiting_confirmation'
                ? `PayMongo received your ${returnedWallet} payment. The invoice is awaiting secure webhook confirmation.`
                : `Your ${returnedWallet} payment is pending. This invoice will update only after PayMongo confirms the payment.`}
          </p>
        ) : checkoutOutcome === 'canceled' ? (
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

        {(invoice.status === 'open' || invoice.status === 'overdue') &&
        invoice.amount_cents > 0 ? (
          <div className="mt-8 border-t border-slate-800 pt-6">
            {checkoutError ? (
              <p className="mb-4 text-sm text-red-300" role="alert">
                {checkoutError}
              </p>
            ) : null}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Choose payment method</h2>
                <p className="mt-1 text-sm text-slate-400">Available methods for this account</p>
              </div>
              <div className="rounded-lg bg-blue-50 px-4 py-3 sm:text-right">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Amount to pay</p>
                <p className="mt-1 text-xl font-bold text-slate-950">
                  {priceFormatter.format(invoice.amount_cents / 100)}
                </p>
              </div>
            </div>

            {paymentMethodsLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 p-6 text-sm text-slate-400">
                <LoadingSpinner size="sm" />
                Loading payment methods...
              </div>
            ) : availablePaymentMethods.length === 0 ? (
              <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-200">
                No payment methods are currently available. Please try again later.
              </p>
            ) : (
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">Payment method</legend>
                {availablePaymentMethods.map((method) => {
                  const details = paymentMethodDetails[method]
                  const selected = selectedPaymentMethod === method
                  return (
                    <button
                      aria-pressed={selected}
                      className={`relative min-h-28 rounded-xl border p-4 pr-12 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                        selected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                      }`}
                      key={method}
                      onClick={() => setSelectedPaymentMethod(method)}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute right-4 top-4 grid size-5 place-items-center rounded-full border ${
                          selected
                            ? 'border-blue-600 bg-blue-600 text-[#ffffff]'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {selected ? <span className="text-xs leading-none">✓</span> : null}
                      </span>
                      {details.logoSrc ? (
                        <img
                          alt=""
                          aria-hidden="true"
                          className={`mb-3 block max-w-28 object-contain object-left ${details.logoClassName ?? ''}`}
                          src={details.logoSrc}
                        />
                      ) : null}
                      <span className="block font-semibold text-slate-950">{details.label}</span>
                      <span className="mt-2 block text-sm leading-5 text-slate-600">
                        {details.description}
                      </span>
                    </button>
                  )
                })}
              </fieldset>
            )}

            {selectedPaymentMethod ? (
              <button
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRedirecting}
                onClick={handleSelectedPayment}
                type="button"
              >
                {redirectProvider ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>
                      {redirectProvider === 'qrph'
                        ? 'Generating QR Ph...'
                        : `Opening ${paymentMethodDetails[redirectProvider].label}...`}
                    </span>
                  </>
                ) : (
                  <span>Continue with {paymentMethodDetails[selectedPaymentMethod].label}</span>
                )}
              </button>
            ) : null}
            {qrPayment ? (
              <div className="mt-4 rounded-xl border border-slate-700 bg-white p-5 text-center text-slate-950">
                {qrPayment.status === 'expired_canceled_or_failed' ? (
                  <p className="text-sm font-medium text-red-700" role="status">
                    This QR payment expired, was canceled, or failed. Generate a new QR code to try again.
                  </p>
                ) : (
                  <>
                    <img
                      alt="Pay this invoice using QR Ph"
                      className="mx-auto h-64 w-64 max-w-full"
                      src={qrPayment.imageUrl}
                    />
                    <p className="mt-3 text-sm font-medium">
                      {qrPayment.status === 'paid_awaiting_confirmation'
                        ? 'Payment received by PayMongo. Awaiting secure confirmation.'
                        : 'Scan using a QR Ph-compatible banking or e-wallet app.'}
                    </p>
                  </>
                )}
                <button
                  className="mt-4 text-sm font-semibold text-slate-600 hover:text-slate-950"
                  onClick={() => setQrPayment(null)}
                  type="button"
                >
                  Close QR
                </button>
              </div>
            ) : null}
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
