import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

type InstallationStatus =
  | 'pending_scheduling'
  | 'scheduled'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'reschedule_required'

interface InstallationOrder {
  id: string
  status: InstallationStatus
  service_address: string
  service_latitude: number | null
  service_longitude: number | null
  scheduled_start_at: string | null
  scheduled_end_at: string | null
  schedule_timezone: 'Asia/Manila'
  technician_id: string | null
  reschedule_count: number
  last_rescheduled_at: string | null
  reschedule_reason: string | null
  created_at: string
  customer: { id: string; full_name: string | null } | null
  plan: { id: string; name: string } | null
  technician: { id: string; full_name: string | null } | null
}

interface AvailableTechnician {
  profile_id: string
  technician_code: string
  availability_status: 'available'
  profile: { full_name: string | null } | null
  coverage_area: { name: string } | null
}

type InstallationFilter =
  | 'all'
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'attention'

const filters: { label: string; value: InstallationFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Attention', value: 'attention' },
]

const appointmentFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
})

const scheduleInputClass =
  'mt-1.5 min-h-11 w-full rounded-[9px] border border-white/10 bg-[#0d121a] px-3 text-sm text-white [color-scheme:dark] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20'

function isInstallationOrder(value: unknown): value is InstallationOrder {
  if (!value || typeof value !== 'object') return false
  const order = value as Record<string, unknown>
  return (
    typeof order.id === 'string' &&
    typeof order.status === 'string' &&
    typeof order.service_address === 'string' &&
    typeof order.reschedule_count === 'number' &&
    typeof order.created_at === 'string'
  )
}

function isAvailableTechnician(value: unknown): value is AvailableTechnician {
  if (!value || typeof value !== 'object') return false
  const technician = value as Record<string, unknown>
  return typeof technician.profile_id === 'string' &&
    typeof technician.technician_code === 'string' &&
    technician.availability_status === 'available'
}

function matchesFilter(status: InstallationStatus, filter: InstallationFilter) {
  if (filter === 'all') return true
  if (filter === 'pending') return status === 'pending_scheduling'
  if (filter === 'scheduled') return status === 'scheduled' || status === 'assigned'
  if (filter === 'attention') return status === 'reschedule_required' || status === 'cancelled'
  return status === filter
}

export function AdminInstallationsPage() {
  const { session } = useAuth()
  const [installations, setInstallations] = useState<InstallationOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<InstallationFilter>('all')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [technicians, setTechnicians] = useState<AvailableTechnician[]>([])

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadInstallations() {
      try {
        const response = await fetch('/api/admin/installations', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('INSTALLATIONS_REQUEST_FAILED')
        const result: unknown = await response.json()
        if (!result || typeof result !== 'object' || !('installations' in result) ||
          !Array.isArray(result.installations) || !result.installations.every(isInstallationOrder)) {
          throw new Error('INVALID_INSTALLATIONS_RESPONSE')
        }
        setInstallations(result.installations)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load installation orders. Please try again later.')
      }
    }

    void loadInstallations()
    return () => controller.abort()
  }, [session])

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadTechnicians() {
      try {
        const response = await fetch('/api/admin/technicians/available', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('TECHNICIANS_REQUEST_FAILED')
        const result: unknown = await response.json()
        if (!result || typeof result !== 'object' || !('technicians' in result) ||
          !Array.isArray(result.technicians) || !result.technicians.every(isAvailableTechnician)) return
        setTechnicians(result.technicians)
      } catch (requestError) {
        if (!(requestError instanceof Error && requestError.name === 'AbortError')) setTechnicians([])
      }
    }
    void loadTechnicians()
    return () => controller.abort()
  }, [session])

  const visibleInstallations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return installations?.filter((order) => matchesFilter(order.status, filter) && (
      !query || order.id.toLowerCase().includes(query) ||
      order.customer?.full_name?.toLowerCase().includes(query) ||
      order.plan?.name.toLowerCase().includes(query) ||
      order.service_address.toLowerCase().includes(query)
    )) ?? []
  }, [filter, installations, search])

  function updateInstallation(updated: InstallationOrder) {
    setInstallations((current) => current?.map((order) =>
      order.id === updated.id ? { ...order, ...updated } : order,
    ) ?? null)
    setEditingId(null)
    setAssigningId(null)
  }

  return (
    <section className="w-full max-w-7xl">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Operations</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">Installations</h1>
          <p className="mt-2 text-sm text-slate-400 sm:text-base">Schedule approved service installations and monitor field progress.</p>
        </div>
        {installations?.length ? (
          <div className="w-full lg:max-w-sm">
            <label className="sr-only" htmlFor="installation-search">Search installations</label>
            <input className="min-h-12 w-full rounded-[10px] border border-white/10 bg-[#0d121a] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" id="installation-search" onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, plan, or address..." type="search" value={search} />
          </div>
        ) : null}
      </header>

      <div className="mt-7">
        {error ? <ErrorPanel message={error} title="Installations unavailable" />
          : installations === null ? <PageSkeleton count={4} type="list" />
            : installations.length === 0 ? <EmptyState description="Approved applications will appear here for scheduling." title="No installation orders" />
              : <>
                <FilterBar filter={filter} installations={installations} onChange={setFilter} />
                <div className="mt-5 overflow-hidden rounded-[14px] border border-white/10 bg-[rgba(14,18,26,0.78)] shadow-[0_14px_38px_rgba(0,0,0,0.16)]">
                  {visibleInstallations.length === 0 ? <p className="px-5 py-14 text-center text-sm text-slate-400">No installations match this filter.</p>
                    : <div className="divide-y divide-white/8">{visibleInstallations.map((order) => (
                      <InstallationRow assigning={assigningId === order.id} editing={editingId === order.id} key={order.id} onAssign={() => { setEditingId(null); setAssigningId(order.id) }} onCancel={() => { setEditingId(null); setAssigningId(null) }} onEdit={() => { setAssigningId(null); setEditingId(order.id) }} onUpdated={updateInstallation} order={order} technicians={technicians} token={session?.access_token ?? ''} />
                    ))}</div>}
                </div>
              </>}
      </div>
    </section>
  )
}

function FilterBar({ filter, installations, onChange }: { filter: InstallationFilter; installations: InstallationOrder[]; onChange: (value: InstallationFilter) => void }) {
  return <div aria-label="Filter installations by status" className="flex gap-1 overflow-x-auto rounded-[12px] border border-white/10 bg-[#0d121a] p-1" role="group">
    {filters.map((item) => {
      const count = installations.filter((order) => matchesFilter(order.status, item.value)).length
      return <button aria-pressed={filter === item.value} className={`min-h-10 min-w-max flex-1 rounded-[9px] px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${filter === item.value ? 'bg-white/8 text-white' : 'text-slate-400 hover:bg-white/4 hover:text-white'}`} key={item.value} onClick={() => onChange(item.value)} type="button">{item.label} <span className="ml-1 text-xs text-slate-500">{count}</span></button>
    })}
  </div>
}

function InstallationRow({ assigning, editing, onAssign, onCancel, onEdit, onUpdated, order, technicians, token }: { assigning: boolean; editing: boolean; onAssign: () => void; onCancel: () => void; onEdit: () => void; onUpdated: (order: InstallationOrder) => void; order: InstallationOrder; technicians: AvailableTechnician[]; token: string }) {
  const canSchedule = !['in_progress', 'completed', 'cancelled'].includes(order.status)
  const coordinates = order.service_latitude !== null && order.service_longitude !== null
    ? `${order.service_latitude.toFixed(5)}, ${order.service_longitude.toFixed(5)}` : null
  return <article className="p-5 sm:p-6">
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1.5fr_1fr_auto] xl:items-start">
      <div><p className="text-xs text-slate-500">#{order.id.slice(0, 8).toUpperCase()}</p><h2 className="mt-1 font-semibold text-white">{order.customer?.full_name ?? 'Customer unavailable'}</h2><p className="mt-1 text-sm text-slate-300">{order.plan?.name ?? 'Plan unavailable'}</p></div>
      <div><p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Service address</p><p className="mt-1 text-sm leading-6 text-slate-200">{order.service_address}</p>{coordinates ? <a className="mt-1 inline-block text-xs font-medium text-blue-300 hover:text-blue-200" href={`https://www.openstreetmap.org/?mlat=${order.service_latitude}&mlon=${order.service_longitude}#map=17/${order.service_latitude}/${order.service_longitude}`} rel="noreferrer" target="_blank">{coordinates} · View map ↗</a> : <p className="mt-1 text-xs text-slate-500">No map pin recorded</p>}</div>
      <div><StatusBadge status={order.status} /><p className="mt-3 text-sm font-medium text-slate-200">{formatSchedule(order)}</p><p className="mt-1 text-xs text-slate-500">Technician: {order.technician?.full_name ?? (order.technician_id ? 'Assigned' : 'Unassigned')}</p>{order.reschedule_count > 0 ? <p className="mt-1 text-xs text-amber-300">Rescheduled {order.reschedule_count} time{order.reschedule_count === 1 ? '' : 's'}</p> : null}</div>
      <div className="flex flex-col gap-2">{canSchedule ? <button className="min-h-10 rounded-[9px] border border-blue-400/30 px-4 text-sm font-semibold text-blue-300 hover:bg-blue-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={onEdit} type="button">{order.scheduled_start_at ? 'Reschedule' : 'Schedule'}</button> : null}{(order.status === 'scheduled' || order.status === 'assigned') ? <button className="min-h-10 rounded-[9px] border border-white/12 px-4 text-sm font-semibold text-slate-200 hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={onAssign} type="button">{order.technician_id ? 'Reassign' : 'Assign technician'}</button> : null}</div>
    </div>
    {editing ? <ScheduleForm onCancel={onCancel} onUpdated={onUpdated} order={order} token={token} /> : null}
    {assigning ? <AssignmentForm onCancel={onCancel} onUpdated={onUpdated} order={order} technicians={technicians} token={token} /> : null}
  </article>
}

function AssignmentForm({ onCancel, onUpdated, order, technicians, token }: { onCancel: () => void; onUpdated: (order: InstallationOrder) => void; order: InstallationOrder; technicians: AvailableTechnician[]; token: string }) {
  const [technicianId, setTechnicianId] = useState(order.technician_id ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isReassignment = order.technician_id !== null && technicianId !== order.technician_id

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/installations/${encodeURIComponent(order.id)}/technician`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician_id: technicianId,
          assignment_reason: isReassignment ? reason : null,
        }),
      })
      const result: unknown = await response.json()
      if (!response.ok || !result || typeof result !== 'object' || !('installation' in result)) {
        throw new Error('ASSIGNMENT_FAILED')
      }
      const assignment = result.installation as { status: InstallationStatus; technician_id: string }
      const selected = technicians.find((technician) => technician.profile_id === assignment.technician_id)
      onUpdated({
        ...order,
        status: assignment.status,
        technician_id: assignment.technician_id,
        technician: selected ? { id: selected.profile_id, full_name: selected.profile?.full_name ?? null } : null,
      })
    } catch {
      setError('This technician could not be assigned. They may have a conflicting appointment or be unavailable.')
      setSaving(false)
    }
  }

  return <form className="mt-5 border-t border-white/8 pt-5" onSubmit={(event) => void submit(event)}><div className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end"><Field label="Available technician"><select className={scheduleInputClass} onChange={(event) => setTechnicianId(event.target.value)} required value={technicianId}><option value="">Select technician</option>{technicians.map((technician) => <option key={technician.profile_id} value={technician.profile_id}>{technician.profile?.full_name ?? 'Unnamed technician'} · {technician.technician_code}{technician.coverage_area?.name ? ` · ${technician.coverage_area.name}` : ''}</option>)}</select></Field>{order.technician_id ? <Field label="Reason for reassignment"><input className={scheduleInputClass} disabled={!isReassignment} minLength={3} onChange={(event) => setReason(event.target.value)} required={isReassignment} value={reason} /></Field> : <p className="text-xs leading-5 text-slate-500">Only active and currently available technicians are listed. Conflicting appointment windows are rejected.</p>}<div className="flex gap-2"><button className="min-h-11 rounded-[9px] bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving || technicians.length === 0} type="submit">{saving ? 'Assigning…' : 'Assign'}</button><button className="min-h-11 rounded-[9px] border border-white/10 px-4 text-sm text-slate-300" disabled={saving} onClick={onCancel} type="button">Cancel</button></div></div>{technicians.length === 0 ? <p className="mt-3 text-sm text-amber-300">No active, available technicians found.</p> : null}{error ? <p className="mt-3 text-sm text-red-300" role="alert">{error}</p> : null}</form>
}

function ScheduleForm({ onCancel, onUpdated, order, token }: { onCancel: () => void; onUpdated: (order: InstallationOrder) => void; order: InstallationOrder; token: string }) {
  const [start, setStart] = useState(toLocalInput(order.scheduled_start_at))
  const [end, setEnd] = useState(toLocalInput(order.scheduled_end_at))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isReschedule = order.scheduled_start_at !== null

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      const response = await fetch(`/api/admin/installations/${encodeURIComponent(order.id)}/schedule`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduled_start_at: new Date(start).toISOString(), scheduled_end_at: new Date(end).toISOString(), reschedule_reason: isReschedule ? reason : null }) })
      const result: unknown = await response.json()
      if (!response.ok || !result || typeof result !== 'object' || !('installation' in result) || !isInstallationOrder({ ...order, ...(result as { installation: object }).installation })) throw new Error('SCHEDULE_FAILED')
      onUpdated({ ...order, ...(result as { installation: Partial<InstallationOrder> }).installation })
    } catch { setError('The appointment could not be saved. Check the time and try again.'); setSaving(false) }
  }

  return <form className="mt-5 border-t border-white/8 pt-5" onSubmit={(event) => void submit(event)}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_auto] xl:items-end"><Field label="Start"><input className={scheduleInputClass} min={toLocalInput(new Date().toISOString())} onChange={(event) => setStart(event.target.value)} required type="datetime-local" value={start} /></Field><Field label="End"><input className={scheduleInputClass} min={start} onChange={(event) => setEnd(event.target.value)} required type="datetime-local" value={end} /></Field>{isReschedule ? <Field label="Reason for rescheduling"><input className={scheduleInputClass} minLength={3} onChange={(event) => setReason(event.target.value)} required value={reason} /></Field> : <p className="text-xs leading-5 text-slate-500">Times are entered in your device timezone and securely stored as an exact instant. Operations display uses Philippine time.</p>}<div className="flex gap-2"><button className="min-h-11 rounded-[9px] bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save'}</button><button className="min-h-11 rounded-[9px] border border-white/10 px-4 text-sm text-slate-300" disabled={saving} onClick={onCancel} type="button">Cancel</button></div></div>{error ? <p className="mt-3 text-sm text-red-300" role="alert">{error}</p> : null}</form>
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="block text-xs font-medium text-slate-400">{label}{children}</label> }
function formatSchedule(order: InstallationOrder) { return order.scheduled_start_at && order.scheduled_end_at ? `${appointmentFormatter.format(new Date(order.scheduled_start_at))} – ${appointmentFormatter.format(new Date(order.scheduled_end_at))}` : 'Not scheduled' }
function toLocalInput(value: string | null) { if (!value) return ''; const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16) }
