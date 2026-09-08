import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'

type WorkStatus = 'assigned' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'reschedule_required'

interface WorkOrder {
  id: string
  subscription_id: string
  status: WorkStatus
  service_address: string
  service_latitude: number | null
  service_longitude: number | null
  scheduled_start_at: string | null
  scheduled_end_at: string | null
  schedule_timezone: 'Asia/Manila'
  internal_notes: string | null
  completed_at: string | null
  completion_notes: string | null
  failure_reason: string | null
  reschedule_required_reason: string | null
  updated_at: string
  customer: { full_name: string | null } | null
  plan: { name: string } | null
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
const timeFormatter = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })

function isWorkOrder(value: unknown): value is WorkOrder {
  if (!value || typeof value !== 'object') return false
  const order = value as Record<string, unknown>
  return typeof order.id === 'string' && typeof order.subscription_id === 'string' &&
    typeof order.status === 'string' && typeof order.service_address === 'string' &&
    (order.internal_notes === null || typeof order.internal_notes === 'string')
}

export function TechnicianWorkQueuePage() {
  const navigate = useNavigate()
  const { session, user } = useAuth()
  const [orders, setOrders] = useState<WorkOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'current' | 'completed'>('current')

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadQueue() {
      try {
        const response = await fetch('/api/technician/installations', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('QUEUE_REQUEST_FAILED')
        const result: unknown = await response.json()
        if (!result || typeof result !== 'object' || !('installations' in result) ||
          !Array.isArray(result.installations) || !result.installations.every(isWorkOrder)) {
          throw new Error('INVALID_QUEUE_RESPONSE')
        }
        setOrders(result.installations)
      } catch (requestError) {
        if (!(requestError instanceof Error && requestError.name === 'AbortError')) setError('We could not load your assigned jobs. Please try again later.')
      }
    }
    void loadQueue()
    return () => controller.abort()
  }, [session])

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const visibleOrders = orders?.filter((order) => filter === 'completed' ? order.status === 'completed' : order.status !== 'completed') ?? []

  function updateOrder(updated: Partial<WorkOrder> & { id: string }) {
    setOrders((current) => current?.map((order) => order.id === updated.id ? { ...order, ...updated } : order) ?? null)
  }

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(71,118,255,0.09),transparent_28%),#0a0d12] text-slate-100">
    <header className="sticky top-0 z-10 border-b border-white/8 bg-[rgba(10,13,18,0.9)] backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6"><div><p className="text-sm font-semibold text-white">ISP Field Operations</p><p className="text-xs text-slate-500">Technician workspace</p></div><button className="min-h-11 rounded-[9px] px-3 text-sm font-medium text-slate-300 hover:bg-white/8 hover:text-white" onClick={() => void signOut()} type="button">Sign out</button></div></header>
    <main className="mx-auto max-w-4xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Work queue</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">Assigned installations</h1><p className="mt-2 text-sm text-slate-400">Signed in as {user?.email ?? 'technician'}</p></div>{orders ? <div className="flex rounded-[10px] border border-white/10 bg-white/4 p-1" role="group" aria-label="Filter work queue"><QueueFilter active={filter === 'current'} label="Current" onClick={() => setFilter('current')} /><QueueFilter active={filter === 'completed'} label="Completed" onClick={() => setFilter('completed')} /></div> : null}</div>
      <div className="mt-7">{error ? <ErrorPanel message={error} title="Work queue unavailable" /> : orders === null ? <PageSkeleton count={3} type="list" /> : visibleOrders.length === 0 ? <EmptyState description={filter === 'completed' ? 'Completed installations will appear here.' : 'You have no assigned installation work right now.'} title={filter === 'completed' ? 'No completed jobs' : 'Queue is clear'} /> : <div className="space-y-4">{visibleOrders.map((order) => <WorkOrderCard key={order.id} onUpdated={updateOrder} order={order} token={session?.access_token ?? ''} />)}</div>}</div>
    </main>
  </div>
}

function QueueFilter({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button aria-pressed={active} className={`min-h-10 rounded-[8px] px-4 text-sm font-medium ${active ? 'bg-white/10 text-white' : 'text-slate-400'}`} onClick={onClick} type="button">{label}</button> }

function WorkOrderCard({ onUpdated, order, token }: { onUpdated: (order: Partial<WorkOrder> & { id: string }) => void; order: WorkOrder; token: string }) {
  const [action, setAction] = useState<'completed' | 'failed' | 'reschedule_required' | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const hasSchedule = order.scheduled_start_at && order.scheduled_end_at
  const hasPin = order.service_latitude !== null && order.service_longitude !== null

  async function changeStatus(status: 'in_progress' | 'failed' | 'reschedule_required', statusReason: string | null) {
    setSaving(true); setActionError(null)
    try {
      const response = await fetch(`/api/installations/${encodeURIComponent(order.id)}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reason: statusReason }) })
      const result: unknown = await response.json()
      if (!response.ok || !result || typeof result !== 'object' || !('installation' in result)) throw new Error('STATUS_UPDATE_FAILED')
      onUpdated({ id: order.id, ...(result.installation as Partial<WorkOrder>) })
      setAction(null); setReason(''); setSaving(false)
    } catch { setActionError('This status change could not be saved. Refresh the queue and try again.'); setSaving(false) }
  }

  async function completeInstallation() {
    setSaving(true); setActionError(null)
    try {
      const response = await fetch(`/api/installations/${encodeURIComponent(order.id)}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ completion_notes: reason }) })
      const result: unknown = await response.json()
      if (!response.ok || !result || typeof result !== 'object' || !('installation' in result)) throw new Error('COMPLETION_FAILED')
      onUpdated({ id: order.id, ...(result.installation as Partial<WorkOrder>) })
      setAction(null); setReason(''); setSaving(false)
    } catch { setActionError('The installation could not be completed. Refresh the queue and try again.'); setSaving(false) }
  }

  return <article className="overflow-hidden rounded-[14px] border border-white/10 bg-[rgba(17,22,31,0.84)] shadow-[0_12px_35px_rgba(0,0,0,0.2)]">
    <div className="flex items-start justify-between gap-4 border-b border-white/8 p-5"><div className="min-w-0"><p className="text-xs font-medium text-slate-500">JOB #{order.id.slice(0, 8).toUpperCase()}</p><h2 className="mt-1 truncate text-lg font-semibold text-white">{order.customer?.full_name ?? 'Customer name unavailable'}</h2><p className="mt-1 text-sm text-slate-400">{order.plan?.name ?? 'Service plan unavailable'}</p></div><StatusBadge className="shrink-0" status={order.status} /></div>
    <div className="grid gap-5 p-5 sm:grid-cols-2"><Detail label="Appointment">{hasSchedule ? <><strong className="block font-semibold text-white">{dateFormatter.format(new Date(order.scheduled_start_at!))}</strong><span>{timeFormatter.format(new Date(order.scheduled_start_at!))} – {timeFormatter.format(new Date(order.scheduled_end_at!))} PHT</span></> : 'Appointment unavailable'}</Detail><Detail label="Service reference"><span className="break-all">{order.subscription_id}</span></Detail><Detail label="Installation address"><span className="leading-6 text-slate-200">{order.service_address}</span>{hasPin ? <a className="mt-2 block font-semibold text-blue-300 hover:text-blue-200" href={`https://www.openstreetmap.org/?mlat=${order.service_latitude}&mlon=${order.service_longitude}#map=17/${order.service_latitude}/${order.service_longitude}`} rel="noreferrer" target="_blank">Open location in map ↗</a> : null}</Detail><Detail label="Operational notes">{order.internal_notes ?? 'No operational notes provided.'}</Detail>{order.failure_reason ? <Detail label="Failure reason">{order.failure_reason}</Detail> : null}{order.reschedule_required_reason ? <Detail label="Reschedule reason">{order.reschedule_required_reason}</Detail> : null}{order.completion_notes ? <Detail label="Completion record">{order.completion_notes}</Detail> : null}</div>
    {(order.status === 'assigned' || order.status === 'in_progress' || order.status === 'failed') ? <div className="border-t border-white/8 p-5">{action ? <form onSubmit={(event) => { event.preventDefault(); if (action === 'completed') void completeInstallation(); else void changeStatus(action, reason) }}><label className="text-xs font-medium text-slate-400">{action === 'completed' ? 'Completion notes' : action === 'failed' ? 'Failure reason' : 'Why is rescheduling needed?'}<textarea className="mt-2 min-h-24 w-full rounded-[9px] border border-white/10 bg-[#0d121a] p-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" maxLength={action === 'completed' ? 2000 : 1000} minLength={action === 'completed' ? 5 : 3} onChange={(event) => setReason(event.target.value)} required value={reason} /></label><div className="mt-3 flex gap-2"><button className="min-h-11 rounded-[9px] bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving…' : action === 'completed' ? 'Confirm completion' : 'Confirm status'}</button><button className="min-h-11 rounded-[9px] border border-white/10 px-4 text-sm text-slate-300" disabled={saving} onClick={() => { setAction(null); setReason('') }} type="button">Cancel</button></div></form> : <div className="flex flex-wrap gap-2">{order.status === 'assigned' ? <button className="min-h-11 rounded-[9px] bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} onClick={() => void changeStatus('in_progress', null)} type="button">Start work</button> : null}{order.status === 'in_progress' ? <><button className="min-h-11 rounded-[9px] bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500" onClick={() => setAction('completed')} type="button">Complete installation</button><button className="min-h-11 rounded-[9px] border border-red-400/25 px-4 text-sm font-semibold text-red-300 hover:bg-red-400/8" onClick={() => setAction('failed')} type="button">Report failed attempt</button></> : null}<button className="min-h-11 rounded-[9px] border border-amber-400/25 px-4 text-sm font-semibold text-amber-300 hover:bg-amber-400/8" onClick={() => setAction('reschedule_required')} type="button">Request reschedule</button></div>}{actionError ? <p className="mt-3 text-sm text-red-300" role="alert">{actionError}</p> : null}</div> : null}
  </article>
}

function Detail({ children, label }: { children: React.ReactNode; label: string }) { return <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p><div className="text-sm text-slate-300">{children}</div></div> }
