import { useEffect, useState } from 'react'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'
import { CustomerPageHeader } from '../account/CustomerPageHeader'
import { isPlanChangeHistoryItem, type PlanChangeHistoryItem } from './plan-change-history'

const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' })

export function PlanChangeHistoryPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<PlanChangeHistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadHistory() {
      try {
        const response = await fetch('/api/subscription/plan-changes', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }, signal: controller.signal,
        })
        if (!response.ok) throw new Error()
        const result: unknown = await response.json()
        if (typeof result !== 'object' || result === null || !('plan_changes' in result) ||
          !Array.isArray(result.plan_changes) || !result.plan_changes.every(isPlanChangeHistoryItem)) throw new Error()
        setItems(result.plan_changes)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load your plan-change history.')
      }
    }
    void loadHistory()
    return () => controller.abort()
  }, [session])

  return <section className="w-full"><CustomerPageHeader description="Review previous and scheduled changes to your internet plan." eyebrow="Subscription" title="Plan-change history" /><div className="mt-8">{error ? <ErrorPanel message={error} title="History unavailable" /> : items === null ? <PageSkeleton count={3} type="list" /> : items.length === 0 ? <EmptyState description="Your upgrades and downgrades will appear here." title="No plan changes" /> : <div className="overflow-hidden rounded-[18px] border border-slate-900/8 bg-white shadow-[0_18px_50px_rgba(18,25,38,0.05)]">{items.map((item) => <HistoryCard item={item} key={item.id} />)}</div>}</div></section>
}

function HistoryCard({ item }: { item: PlanChangeHistoryItem }) {
  return <article className="border-b border-slate-900/8 p-5 last:border-b-0 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500 capitalize">{item.change_type}</p><h2 className="mt-2 text-lg font-semibold text-slate-950">{item.current_plan?.name ?? 'Unavailable plan'} <span aria-hidden="true">→</span> {item.requested_plan?.name ?? 'Unavailable plan'}</h2></div><StatusBadge status={item.status} /></div><dl className="mt-5 grid gap-4 border-t border-slate-900/8 pt-4 sm:grid-cols-2"><Detail label="Requested" value={dateFormatter.format(new Date(item.requested_at))} /><Detail label="Effective date" value={item.effective_at ? dateFormatter.format(new Date(item.effective_at)) : 'Not scheduled'} /></dl>{item.reason ? <p className="mt-4 text-sm text-slate-600"><strong className="text-slate-800">Reason:</strong> {item.reason}</p> : null}{item.review_notes ? <p className="mt-2 text-sm text-slate-600"><strong className="text-slate-800">Status note:</strong> {item.review_notes}</p> : null}</article>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>
}
