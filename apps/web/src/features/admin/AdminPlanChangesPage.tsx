import { useEffect, useState } from 'react'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'
import { isAdminPlanChangeHistoryItem, type AdminPlanChangeHistoryItem } from '../subscriptions/plan-change-history'

const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' })

export function AdminPlanChangesPage() {
  const { session } = useAuth()
  const [items, setItems] = useState<AdminPlanChangeHistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadHistory() {
      try {
        const response = await fetch('/api/admin/plan-changes', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }, signal: controller.signal,
        })
        if (!response.ok) throw new Error()
        const result: unknown = await response.json()
        if (typeof result !== 'object' || result === null || !('plan_changes' in result) ||
          !Array.isArray(result.plan_changes) || !result.plan_changes.every(isAdminPlanChangeHistoryItem)) throw new Error()
        setItems(result.plan_changes)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load plan-change history.')
      }
    }
    void loadHistory()
    return () => controller.abort()
  }, [session])

  return <section className="w-full"><header><p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Admin portal</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">Plan changes</h1><p className="mt-2 text-sm text-slate-400">Read-only history of customer upgrades and downgrades.</p></header><div className="mt-7">{error ? <ErrorPanel message={error} title="History unavailable" /> : items === null ? <PageSkeleton count={5} type="list" /> : items.length === 0 ? <EmptyState description="Customer plan-change requests will appear here." title="No plan changes" /> : <div className="overflow-hidden rounded-[14px] border border-white/8 bg-[#11161f]"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b border-white/8 bg-white/3 text-xs tracking-[0.08em] text-slate-500 uppercase"><tr><th className="px-5 py-4">Customer</th><th className="px-5 py-4">Change</th><th className="px-5 py-4">Plans</th><th className="px-5 py-4">Requested</th><th className="px-5 py-4">Effective</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-white/8">{items.map((item) => <tr className="text-slate-300" key={item.id}><td className="px-5 py-4 font-medium text-white">{item.customer?.full_name ?? 'Unknown customer'}</td><td className="px-5 py-4 capitalize">{item.change_type}</td><td className="px-5 py-4"><span className="text-slate-400">{item.current_plan?.name ?? 'Unavailable'}</span> <span aria-hidden="true">→</span> <span className="text-white">{item.requested_plan?.name ?? 'Unavailable'}</span>{item.reason ? <p className="mt-1 max-w-xs truncate text-xs text-slate-500" title={item.reason}>{item.reason}</p> : null}</td><td className="px-5 py-4">{formatDate(item.requested_at)}</td><td className="px-5 py-4">{item.effective_at ? formatDate(item.effective_at) : '—'}</td><td className="px-5 py-4"><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></div>}</div></section>
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value))
}
