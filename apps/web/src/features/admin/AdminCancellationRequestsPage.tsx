import { useEffect, useState } from 'react'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { moneyFormatter } from '../../lib/money'
import { useAuth } from '../auth/auth-context'

type Decision = 'approved' | 'rejected' | 'scheduled'
type RequestStatus = 'pending' | 'approved' | 'rejected' | 'scheduled' | 'completed' | 'withdrawn'

interface CancellationItem {
  id: string
  subscription_id: string
  request_source: 'customer' | 'admin'
  reason: string
  requested_at: string
  desired_termination_date: string | null
  effective_termination_date: string | null
  status: RequestStatus
  reviewed_at: string | null
  review_notes: string | null
  outstanding_cents: number
  overdue_invoices: number
  customer: { id: string; full_name: string | null } | null
  subscription: { id: string; status: string; started_at: string | null; plan: { id: string; name: string; price_cents: number; billing_interval: string } | null } | null
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' })

export function AdminCancellationRequestsPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<CancellationItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadRequests() {
      try {
        const response = await fetch('/api/admin/cancellation-requests', { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }, signal: controller.signal })
        if (!response.ok) throw new Error()
        const result: unknown = await response.json()
        if (!isResponse(result)) throw new Error()
        setItems(result.cancellation_requests)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load cancellation requests.')
      }
    }
    void loadRequests()
    return () => controller.abort()
  }, [session])

  function updateItem(updated: { id: string; status: RequestStatus; effective_termination_date: string | null; reviewed_at: string | null; review_notes: string | null }) {
    setItems((current) => current?.map((item) => item.id === updated.id ? { ...item, ...updated } : item) ?? null)
  }

  return <section className="w-full"><header><p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Admin portal</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">Cancellation requests</h1><p className="mt-2 text-sm text-slate-400">Review customer requests without deleting service or billing history.</p></header><div className="mt-7">{error ? <ErrorPanel message={error} title="Requests unavailable" /> : items === null ? <PageSkeleton count={4} type="list" /> : items.length === 0 ? <EmptyState description="Customer cancellation requests will appear here." title="No cancellation requests" /> : <div className="space-y-4">{items.map((item) => <CancellationCard item={item} key={item.id} onUpdated={updateItem} />)}</div>}</div></section>
}

function CancellationCard({ item, onUpdated }: { item: CancellationItem; onUpdated: (item: { id: string; status: RequestStatus; effective_termination_date: string | null; reviewed_at: string | null; review_notes: string | null }) => void }) {
  const { session } = useAuth()
  const [decision, setDecision] = useState<Decision>(item.status === 'approved' ? 'scheduled' : 'approved')
  const [date, setDate] = useState(item.desired_termination_date ?? '')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const canReview = item.status === 'pending' || item.status === 'approved'

  async function review() {
    if (!session || isSaving) return
    if (decision === 'rejected' && notes.trim().length < 3) { setMessage('Enter a rejection reason.'); return }
    if (decision === 'scheduled' && !date) { setMessage('Choose an effective termination date.'); return }
    if (decision === 'scheduled' && !window.confirm(`Schedule service termination for ${formatDate(date)}? Service is not terminated yet.`)) return
    setIsSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/admin/cancellation-requests/${encodeURIComponent(item.id)}/review`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, effective_termination_date: decision === 'scheduled' ? date : null, review_notes: notes.trim() || null }) })
      const result: unknown = await response.json()
      if (!response.ok || !isReviewResponse(result)) throw new Error(getError(result))
      onUpdated(result.cancellation_request)
      setMessage(`Request marked ${result.cancellation_request.status}.`)
    } catch (requestError) { setMessage(requestError instanceof Error ? requestError.message : 'Unable to review request.') } finally { setIsSaving(false) }
  }

  return <article className="rounded-[14px] border border-white/8 bg-[#11161f] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-slate-500">Requested {dateFormatter.format(new Date(item.requested_at))} · {item.request_source}</p><h2 className="mt-2 text-lg font-semibold text-white">{item.customer?.full_name ?? 'Unknown customer'}</h2><p className="mt-1 text-sm text-slate-400">{item.subscription?.plan?.name ?? 'Plan unavailable'} · Service {item.subscription?.status ?? 'unavailable'}</p></div><StatusBadge status={item.status} /></div><div className="mt-5 grid gap-4 border-t border-white/8 pt-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Customer reason" value={item.reason} /><Detail label="Preferred date" value={item.desired_termination_date ? formatDate(item.desired_termination_date) : 'No preference'} /><Detail label="Outstanding balance" value={moneyFormatter.format(item.outstanding_cents / 100)} /><Detail label="Overdue invoices" value={String(item.overdue_invoices)} /></div>{item.review_notes ? <p className="mt-4 text-sm text-slate-400"><strong className="text-slate-200">Review note:</strong> {item.review_notes}</p> : null}{canReview ? <div className="mt-5 rounded-[10px] border border-white/8 bg-black/15 p-4"><div className="grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold text-slate-300">Decision<select className="mt-2 min-h-11 w-full rounded-[9px] border border-white/10 bg-[#0a0d12] px-3 text-sm text-white" onChange={(event) => setDecision(event.target.value as Decision)} value={decision}>{item.status === 'pending' ? <option value="approved">Approve for scheduling</option> : null}<option value="scheduled">Schedule termination</option>{item.status === 'pending' ? <option value="rejected">Reject request</option> : null}</select></label>{decision === 'scheduled' ? <label className="text-xs font-semibold text-slate-300">Effective date<input className="mt-2 min-h-11 w-full rounded-[9px] border border-white/10 bg-[#0a0d12] px-3 text-sm text-white" min={localDate()} onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label> : null}<label className="text-xs font-semibold text-slate-300">{decision === 'rejected' ? 'Rejection reason' : 'Review note (optional)'}<textarea className="mt-2 min-h-20 w-full rounded-[9px] border border-white/10 bg-[#0a0d12] px-3 py-2 text-sm text-white" maxLength={1000} onChange={(event) => setNotes(event.target.value)} value={notes} /></label></div><button className="mt-3 min-h-10 rounded-[9px] bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50" disabled={isSaving} onClick={() => void review()} type="button">{isSaving ? 'Saving…' : 'Confirm decision'}</button>{message ? <p className="mt-3 text-xs text-slate-300" role="status">{message}</p> : null}</div> : null}</article>
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-200">{value}</p></div> }
function formatDate(value: string) { return dateFormatter.format(new Date(`${value}T00:00:00`)) }
function localDate() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) }
function isResponse(value: unknown): value is { cancellation_requests: CancellationItem[] } { return typeof value === 'object' && value !== null && 'cancellation_requests' in value && Array.isArray(value.cancellation_requests) }
function isReviewResponse(value: unknown): value is { cancellation_request: { id: string; status: RequestStatus; effective_termination_date: string | null; reviewed_at: string | null; review_notes: string | null } } { if (typeof value !== 'object' || value === null || !('cancellation_request' in value) || typeof value.cancellation_request !== 'object' || value.cancellation_request === null) return false; const item = value.cancellation_request as Record<string, unknown>; return typeof item.id === 'string' && typeof item.status === 'string' }
function getError(value: unknown) { return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string' ? value.error : 'Unable to review request.' }
