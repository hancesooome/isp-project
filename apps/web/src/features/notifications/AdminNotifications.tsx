import { useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { darkUtilityButtonClass } from '../../components/ui/utility-button-styles'
import { useAuth } from '../auth/auth-context'

interface AdminNotification {
  id: string
  notification_type: string
  title: string
  message: string
  related_entity_type: string | null
  related_entity_id: string | null
  navigation_path: string | null
  read_at: string | null
  created_at: string
}

interface AdminNotificationFeed {
  notifications: AdminNotification[]
  unread_count: number
}

const timestampFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' })

function readFeed(value: unknown): AdminNotificationFeed {
  if (!value || typeof value !== 'object') throw new Error('INVALID_ADMIN_NOTIFICATION_FEED')
  const feed = value as Record<string, unknown>
  if (!Array.isArray(feed.notifications) || typeof feed.unread_count !== 'number' || !Number.isInteger(feed.unread_count) || feed.unread_count < 0) throw new Error('INVALID_ADMIN_NOTIFICATION_FEED')
  const valid = feed.notifications.every((value) => {
    if (!value || typeof value !== 'object') return false
    const item = value as Record<string, unknown>
    return typeof item.id === 'string' && typeof item.notification_type === 'string' &&
      typeof item.title === 'string' && typeof item.message === 'string' &&
      (item.related_entity_type === null || typeof item.related_entity_type === 'string') &&
      (item.related_entity_id === null || typeof item.related_entity_id === 'string') &&
      (item.navigation_path === null || typeof item.navigation_path === 'string') &&
      (item.read_at === null || typeof item.read_at === 'string') && typeof item.created_at === 'string'
  })
  if (!valid) throw new Error('INVALID_ADMIN_NOTIFICATION_FEED')
  return { notifications: feed.notifications, unread_count: feed.unread_count }
}

function isSafeAdminPath(path: string | null): path is string {
  return path === '/admin' || Boolean(path?.startsWith('/admin/'))
}

function announceUpdate() {
  window.dispatchEvent(new Event('admin-notifications-updated'))
}

export function AdminNotificationBell({ refreshKey }: { refreshKey: string }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [feed, setFeed] = useState<AdminNotificationFeed | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/notifications?limit=5', { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }, signal: controller.signal })
        if (!response.ok) throw new Error('ADMIN_NOTIFICATIONS_FAILED')
        setFeed(readFeed(await response.json())); setLoadError(false)
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) setLoadError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [session, refreshKey])

  useEffect(() => {
    if (!session) return
    async function refresh() {
      try {
        const response = await fetch('/api/notifications?limit=5', { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
        if (response.ok) { setFeed(readFeed(await response.json())); setLoadError(false) }
      } catch { setLoadError(true) }
    }
    window.addEventListener('admin-notifications-updated', refresh)
    return () => window.removeEventListener('admin-notifications-updated', refresh)
  }, [session])

  async function openNotification(item: AdminNotification) {
    if (!session) return
    if (!item.read_at) {
      const response = await fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}` } })
      if (response.ok) setFeed((current) => current ? { notifications: current.notifications.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry), unread_count: Math.max(0, current.unread_count - 1) } : current)
    }
    if (isSafeAdminPath(item.navigation_path)) navigate(item.navigation_path)
  }

  return <details className="relative"><summary className={`${darkUtilityButtonClass} relative cursor-pointer list-none`} title="Admin notifications"><Bell aria-hidden="true" size={18} strokeWidth={1.8} /><span className="sr-only">Open admin notifications{feed?.unread_count ? `, ${feed.unread_count} unread` : ''}</span>{feed?.unread_count ? <span className="absolute -top-0.5 -right-0.5 grid min-h-4 min-w-4 place-items-center rounded-full border border-[#11161f] bg-blue-500 px-1 text-[9px] font-bold text-white">{feed.unread_count > 99 ? '99+' : feed.unread_count}</span> : null}</summary><div className="fixed inset-x-4 top-[4.5rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-[14px] border border-white/10 bg-[rgba(17,22,31,0.98)] shadow-2xl backdrop-blur-xl md:absolute md:inset-x-auto md:top-auto md:left-0 md:mt-2 md:w-[min(23rem,calc(100vw-2rem))]"><div className="flex items-center justify-between border-b border-white/8 px-4 py-3"><div><p className="font-semibold text-white">Operations alerts</p><p className="text-xs text-slate-500">Items that may need attention</p></div><Link className="text-xs font-semibold text-blue-300 hover:text-blue-200" to="/admin/notifications">View all</Link></div>{loadError ? <p className="p-4 text-sm text-red-300">Notifications could not be loaded.</p> : !feed ? <p className="p-4 text-sm text-slate-500">Loading notifications…</p> : feed.notifications.length === 0 ? <p className="p-4 text-sm text-slate-500">No action items right now.</p> : <ul className="max-h-96 divide-y divide-white/8 overflow-y-auto">{feed.notifications.map((item) => <li key={item.id}><button className={`w-full px-4 py-3 text-left hover:bg-white/5 ${item.read_at ? '' : 'bg-blue-500/8'}`} onClick={() => void openNotification(item)} type="button"><span className="block text-sm font-semibold text-white">{item.title}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{item.message}</span><time className="mt-1 block text-[11px] text-slate-600" dateTime={item.created_at}>{timestampFormatter.format(new Date(item.created_at))}</time></button></li>)}</ul>}</div></details>
}

export function AdminNotificationsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [feed, setFeed] = useState<AdminNotificationFeed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/notifications?limit=100', { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` }, signal: controller.signal })
        if (!response.ok) throw new Error('ADMIN_NOTIFICATIONS_FAILED')
        setFeed(readFeed(await response.json())); setError(null)
      } catch (requestError) {
        if (!(requestError instanceof Error && requestError.name === 'AbortError')) setError('We could not load administrator notifications.')
      }
    }
    void load()
    return () => controller.abort()
  }, [session])

  async function openNotification(item: AdminNotification) {
    if (!session) return
    if (!item.read_at) {
      const response = await fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) { setError('We could not update this notification.'); return }
      setFeed((current) => current ? { notifications: current.notifications.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry), unread_count: Math.max(0, current.unread_count - 1) } : current); announceUpdate()
    }
    if (isSafeAdminPath(item.navigation_path)) navigate(item.navigation_path)
  }

  async function markAllRead() {
    if (!session || saving || !feed?.unread_count) return
    setSaving(true); setError(null)
    try {
      const response = await fetch('/api/notifications/read-all', { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw new Error('MARK_ALL_FAILED')
      const readAt = new Date().toISOString()
      setFeed((current) => current ? { notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at ?? readAt })), unread_count: 0 } : current); announceUpdate()
    } catch { setError('We could not mark administrator notifications as read.') } finally { setSaving(false) }
  }

  return <section className="w-full max-w-5xl"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.18em] text-blue-400 uppercase">Admin portal</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-white">Operations alerts</h1><p className="mt-2 text-sm text-slate-400">Customer requests and installation issues requiring awareness.</p></div>{feed?.unread_count ? <button className="inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-white/10 bg-white/6 px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60" disabled={saving} onClick={() => void markAllRead()} type="button"><CheckCheck aria-hidden="true" size={17} />{saving ? 'Updating…' : 'Mark all as read'}</button> : null}</header><div className="mt-7">{error && !feed ? <ErrorPanel message={error} title="Alerts unavailable" /> : !feed ? <PageSkeleton count={5} type="list" /> : feed.notifications.length === 0 ? <EmptyState description="New customer requests and operational exceptions will appear here." title="No action items" /> : <div className="overflow-hidden rounded-[14px] border border-white/8 bg-[#11161f] shadow-lg">{error ? <p className="border-b border-red-400/20 bg-red-400/8 p-4 text-sm text-red-300" role="alert">{error}</p> : null}<ul className="divide-y divide-white/8">{feed.notifications.map((item) => <li key={item.id}><button className={`flex w-full items-start gap-4 p-5 text-left transition hover:bg-white/5 ${item.read_at ? '' : 'bg-blue-500/6'}`} onClick={() => void openNotification(item)} type="button"><span aria-hidden="true" className={`mt-1 size-2.5 shrink-0 rounded-full ${item.read_at ? 'bg-slate-700' : 'bg-blue-400'}`} /><span className="min-w-0 flex-1"><span className="block font-semibold text-white">{item.title}</span><span className="mt-1 block text-sm leading-6 text-slate-400">{item.message}</span><time className="mt-2 block text-xs text-slate-600" dateTime={item.created_at}>{timestampFormatter.format(new Date(item.created_at))}</time></span>{isSafeAdminPath(item.navigation_path) ? <span aria-hidden="true" className="text-slate-600">→</span> : null}</button></li>)}</ul></div>}</div></section>
}
