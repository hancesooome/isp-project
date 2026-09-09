import { useEffect, useState, type FormEvent } from 'react'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

type CancellationStatus = 'pending' | 'approved' | 'rejected' | 'scheduled' | 'completed' | 'withdrawn'

interface CancellationSubscription {
  id: string
  status: 'active' | 'past_due' | 'suspended'
  plan: { id: string; name: string } | null
}

interface CancellationRequest {
  id: string
  subscription_id: string
  reason: string
  requested_at: string
  desired_termination_date: string | null
  effective_termination_date: string | null
  status: CancellationStatus
  review_notes: string | null
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' })
const openStatuses: CancellationStatus[] = ['pending', 'approved', 'scheduled']

export function CancellationRequestPage() {
  const { session } = useAuth()
  const [subscription, setSubscription] = useState<CancellationSubscription | null>()
  const [request, setRequest] = useState<CancellationRequest | null>()
  const [reason, setReason] = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadRequest() {
      try {
        const response = await fetch('/api/subscription/cancellation-request', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('CANCELLATION_REQUEST_FAILED')

        const result: unknown = await response.json()
        if (!isCancellationResponse(result)) throw new Error('INVALID_CANCELLATION_RESPONSE')
        setSubscription(result.subscription)
        setRequest(result.cancellation_request)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load your cancellation information. Please try again later.')
      }
    }

    void loadRequest()
    return () => controller.abort()
  }, [session])

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || !subscription || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch('/api/subscription/cancellation-request', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_id: subscription.id,
          reason: reason.trim(),
          desired_termination_date: desiredDate || null,
          acknowledged,
        }),
      })
      const result: unknown = await response.json()
      if (!response.ok || !isCreatedCancellationResponse(result)) {
        const message = getApiError(result)
        throw new Error(message)
      }

      setRequest(result.cancellation_request)
      setReason('')
      setDesiredDate('')
      setAcknowledged(false)
    } catch (requestError) {
      setSubmitError(requestError instanceof Error && requestError.message !== 'CANCELLATION_REQUEST_FAILED'
        ? requestError.message
        : 'We could not submit your request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (error) return <ErrorPanel message={error} title="Cancellation unavailable" />
  if (subscription === undefined || request === undefined) return <PageSkeleton type="detail" />
  if (!subscription) {
    if (!request) return <EmptyState description="An active, past-due, or suspended subscription is required." title="No eligible service" />
    return <section className="w-full max-w-3xl"><header><p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase">Service request</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Cancel internet service</h1><p className="mt-3 text-slate-600">Review the latest cancellation request associated with your account.</p></header><RequestStatus request={request} /></section>
  }

  const hasOpenRequest = request ? openStatuses.includes(request.status) : false
  const currentPlanName = subscription.plan?.name ?? 'Plan unavailable'

  return (
    <section className="w-full max-w-3xl">
      <header>
        <p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase">Service request</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Cancel internet service</h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">Request a review of your service cancellation. Submitting this form does not immediately terminate service.</p>
      </header>

      {request ? <RequestStatus request={request} /> : null}

      {!hasOpenRequest ? (
        <form className="mt-6 rounded-[18px] border border-slate-900/8 bg-white p-6 shadow-[0_18px_50px_rgba(18,25,38,0.06)] sm:p-8" onSubmit={(event) => void submitRequest(event)}>
          <h2 className="text-lg font-semibold text-slate-950">Cancellation request</h2>
          <p className="mt-1 text-sm text-slate-500">Current plan: {currentPlanName}</p>

          <div className="mt-6 rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">Before you continue</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your service remains active in the platform until the request is approved and processed.</li>
              <li>Existing invoices, balances, and payment obligations remain on your account.</li>
              <li>An administrator will confirm the effective termination date.</li>
              <li>This request does not itself disconnect physical network equipment.</li>
            </ul>
          </div>

          <label className="mt-6 block text-sm font-semibold text-slate-800" htmlFor="cancellation-reason">Reason for cancellation</label>
          <textarea className="mt-2 min-h-32 w-full rounded-[10px] border border-slate-900/15 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" id="cancellation-reason" maxLength={1000} minLength={3} onChange={(event) => setReason(event.target.value)} placeholder="Tell us why you want to cancel" required value={reason} />

          <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="desired-termination-date">Preferred termination date <span className="font-normal text-slate-500">(optional)</span></label>
          <input className="mt-2 min-h-12 w-full rounded-[10px] border border-slate-900/15 bg-white px-4 text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" id="desired-termination-date" min={getLocalDate()} onChange={(event) => setDesiredDate(event.target.value)} type="date" value={desiredDate} />
          <p className="mt-2 text-xs text-slate-500">This is your preference; the approved date may differ.</p>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-[12px] border border-slate-900/10 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <input checked={acknowledged} className="mt-1 size-4 shrink-0 accent-blue-600" onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
            <span>I understand the consequences above and explicitly request cancellation review.</span>
          </label>

          {submitError ? <p className="mt-4 text-sm text-red-700" role="alert">{submitError}</p> : null}
          <button className="mt-6 min-h-12 w-full rounded-[10px] bg-red-700 px-5 font-semibold text-white shadow-sm hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-45" disabled={isSubmitting || reason.trim().length < 3 || !acknowledged} type="submit">{isSubmitting ? 'Submitting…' : 'Submit cancellation request'}</button>
        </form>
      ) : null}
    </section>
  )
}

function RequestStatus({ request }: { request: CancellationRequest }) {
  return <article className="mt-8 rounded-[18px] border border-slate-900/8 bg-white p-6 shadow-[0_18px_50px_rgba(18,25,38,0.06)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">Latest request</p><h2 className="mt-2 text-lg font-semibold text-slate-950">Cancellation status</h2></div><StatusBadge status={request.status} /></div><dl className="mt-5 grid gap-4 border-t border-slate-900/8 pt-5 sm:grid-cols-2"><Detail label="Requested" value={dateFormatter.format(new Date(request.requested_at))} /><Detail label="Preferred date" value={request.desired_termination_date ? formatDatabaseDate(request.desired_termination_date) : 'No preference'} /><Detail label="Effective date" value={request.effective_termination_date ? formatDatabaseDate(request.effective_termination_date) : 'Not scheduled'} /><Detail label="Reason" value={request.reason} /></dl>{request.review_notes ? <p className="mt-5 rounded-[10px] bg-slate-50 p-4 text-sm text-slate-700"><strong>Review note:</strong> {request.review_notes}</p> : null}</article>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd></div>
}

function getLocalDate(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDatabaseDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00`))
}

function isCancellationResponse(value: unknown): value is { subscription: CancellationSubscription | null; cancellation_request: CancellationRequest | null } {
  if (typeof value !== 'object' || value === null || !('subscription' in value) || !('cancellation_request' in value)) return false
  return (value.subscription === null || isSubscription(value.subscription)) && (value.cancellation_request === null || isCancellationRequest(value.cancellation_request))
}

function isCreatedCancellationResponse(value: unknown): value is { cancellation_request: CancellationRequest } {
  return typeof value === 'object' && value !== null && 'cancellation_request' in value && isCancellationRequest(value.cancellation_request)
}

function isSubscription(value: unknown): value is CancellationSubscription {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  const plan = item.plan
  return typeof item.id === 'string' && (item.status === 'active' || item.status === 'past_due' || item.status === 'suspended') && (plan === null || (typeof plan === 'object' && plan !== null && 'id' in plan && typeof plan.id === 'string' && 'name' in plan && typeof plan.name === 'string'))
}

function isCancellationRequest(value: unknown): value is CancellationRequest {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.subscription_id === 'string' && typeof item.reason === 'string' && typeof item.requested_at === 'string' && isNullableString(item.desired_termination_date) && isNullableString(item.effective_termination_date) && (item.status === 'pending' || item.status === 'approved' || item.status === 'rejected' || item.status === 'scheduled' || item.status === 'completed' || item.status === 'withdrawn') && isNullableString(item.review_notes)
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function getApiError(value: unknown): string {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string'
    ? value.error
    : 'We could not submit your request. Please try again.'
}
