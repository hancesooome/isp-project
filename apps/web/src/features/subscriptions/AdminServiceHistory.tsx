import { useEffect, useState } from 'react'

import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { useAuth } from '../auth/auth-context'

interface AdminHistoryEvent {
  id: string
  event_type: string
  occurred_at: string
  summary: string
  reason: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  actor: { full_name: string | null; role: string } | null
}

const timestampFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function AdminServiceHistory({ subscriptionId }: { subscriptionId: string }) {
  const { session } = useAuth()
  const [events, setEvents] = useState<AdminHistoryEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadHistory() {
      try {
        const response = await fetch(`/api/admin/subscriptions/${encodeURIComponent(subscriptionId)}/service-history`, {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error()
        const result: unknown = await response.json()
        if (!isHistoryResponse(result)) throw new Error()
        setEvents(result.service_history)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load the operational service history.')
      }
    }
    void loadHistory()
    return () => controller.abort()
  }, [session, subscriptionId])

  if (error) return <div className="mt-5"><ErrorPanel message={error} title="Service history unavailable" /></div>
  if (events === null) return <div className="mt-5"><PageSkeleton count={3} type="list" /></div>

  return <section className="mt-5 overflow-hidden rounded-[12px] border border-white/8 bg-[#11161f]" aria-labelledby="service-history-heading"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4"><div><h2 className="text-sm font-semibold text-white" id="service-history-heading">Service history</h2><p className="mt-1 text-xs text-slate-500">Append-only operational timeline · newest first</p></div><span className="text-xs text-slate-500">{events.length} event{events.length === 1 ? '' : 's'}</span></div>{events.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">No lifecycle events have been recorded.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-white/8 bg-white/3 text-[11px] tracking-[0.08em] text-slate-500 uppercase"><tr><th className="px-5 py-3">Timestamp</th><th className="px-5 py-3">Event</th><th className="px-5 py-3">Actor</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3">Related record</th></tr></thead><tbody className="divide-y divide-white/8">{events.map((event) => <tr className="align-top text-slate-300" key={event.id}><td className="whitespace-nowrap px-5 py-3 text-xs text-slate-400">{timestampFormatter.format(new Date(event.occurred_at))}</td><td className="px-5 py-3"><p className="font-medium text-white">{event.summary}</p><p className="mt-1 text-xs text-slate-500">{event.event_type.replaceAll('_', ' ')}</p></td><td className="px-5 py-3">{event.actor ? <><span className="text-slate-200">{event.actor.full_name ?? 'Unnamed user'}</span><span className="mt-1 block text-xs capitalize text-slate-500">{event.actor.role}</span></> : <span className="text-slate-500">System</span>}</td><td className="max-w-xs px-5 py-3 text-slate-400">{event.reason ?? '—'}</td><td className="px-5 py-3">{formatRelatedRecord(event)}</td></tr>)}</tbody></table></div>}</section>
}

function formatRelatedRecord(event: AdminHistoryEvent) {
  if (!event.related_entity_type || !event.related_entity_id) return <span className="text-slate-500">—</span>
  return <><span className="block capitalize text-slate-300">{event.related_entity_type.replaceAll('_', ' ')}</span><code className="mt-1 block text-xs text-slate-500" title={event.related_entity_id}>#{event.related_entity_id.slice(0, 8).toUpperCase()}</code></>
}

function isHistoryResponse(value: unknown): value is { service_history: AdminHistoryEvent[] } {
  if (typeof value !== 'object' || value === null || !('service_history' in value) || !Array.isArray(value.service_history)) return false
  return value.service_history.every((event) => {
    if (typeof event !== 'object' || event === null) return false
    const item = event as Record<string, unknown>
    return typeof item.id === 'string' && typeof item.event_type === 'string' && typeof item.occurred_at === 'string' && typeof item.summary === 'string' && nullableString(item.reason) && nullableString(item.related_entity_type) && nullableString(item.related_entity_id) && (item.actor === null || (typeof item.actor === 'object' && item.actor !== null && 'full_name' in item.actor && nullableString(item.actor.full_name) && 'role' in item.actor && typeof item.actor.role === 'string'))
  })
}

function nullableString(value: unknown): value is string | null { return typeof value === 'string' || value === null }
