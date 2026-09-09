import { useEffect, useState } from 'react'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { useAuth } from '../auth/auth-context'

interface ServiceHistoryEvent {
  id: string
  subscription_id: string
  event_type: string
  occurred_at: string
  summary: string
  reason: string | null
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function ServiceHistoryPage() {
  const { session } = useAuth()
  const [events, setEvents] = useState<ServiceHistoryEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadHistory() {
      try {
        const response = await fetch('/api/subscription/service-history', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error()
        const result: unknown = await response.json()
        if (!isHistoryResponse(result)) throw new Error()
        setEvents(result.service_history)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load your service history. Please try again later.')
      }
    }
    void loadHistory()
    return () => controller.abort()
  }, [session])

  return <section className="w-full max-w-4xl"><header><p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase">Your service</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Service history</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">Follow the important milestones for your internet service, from installation through account changes.</p></header><div className="mt-8">{error ? <ErrorPanel message={error} title="History unavailable" /> : events === null ? <PageSkeleton count={5} type="list" /> : events.length === 0 ? <EmptyState description="Your service milestones will appear here as your application progresses." title="No service history yet" /> : <ol className="relative ml-3 border-l border-slate-300">{events.map((event) => <li className="relative pb-8 pl-8 last:pb-0" key={event.id}><span aria-hidden="true" className={`absolute -left-[7px] top-1 size-3 rounded-full border-2 border-white ${dotStyle(event.event_type)}`} /><article className="rounded-[14px] border border-slate-900/8 bg-white p-5 shadow-[0_12px_36px_rgba(18,25,38,0.05)]"><p className="text-xs font-medium text-slate-500">{dateFormatter.format(new Date(event.occurred_at))}</p><h2 className="mt-2 text-base font-semibold text-slate-950">{event.summary}</h2>{event.reason ? <p className="mt-2 text-sm leading-6 text-slate-600"><strong className="text-slate-800">Reason:</strong> {event.reason}</p> : null}</article></li>)}</ol>}</div></section>
}

function isHistoryResponse(value: unknown): value is { service_history: ServiceHistoryEvent[] } {
  if (typeof value !== 'object' || value === null || !('service_history' in value) || !Array.isArray(value.service_history)) return false
  return value.service_history.every((event) => {
    if (typeof event !== 'object' || event === null) return false
    const item = event as Record<string, unknown>
    return typeof item.id === 'string' && typeof item.subscription_id === 'string' && typeof item.event_type === 'string' && typeof item.occurred_at === 'string' && typeof item.summary === 'string' && (typeof item.reason === 'string' || item.reason === null)
  })
}

function dotStyle(eventType: string): string {
  if (eventType === 'terminated' || eventType === 'suspended' || eventType === 'installation_failed') return 'bg-red-500'
  if (eventType === 'service_activated' || eventType === 'restored' || eventType === 'installation_completed') return 'bg-emerald-500'
  return 'bg-blue-500'
}
