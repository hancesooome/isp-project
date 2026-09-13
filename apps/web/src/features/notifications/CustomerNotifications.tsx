import { useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { useAuth } from '../auth/auth-context'

interface Notification {
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

interface NotificationFeed {
  notifications: Notification[]
  unread_count: number
}

const timestampFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function isNotification(value: unknown): value is Notification {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' &&
    typeof item.notification_type === 'string' &&
    typeof item.title === 'string' &&
    typeof item.message === 'string' &&
    (item.related_entity_type === null || typeof item.related_entity_type === 'string') &&
    (item.related_entity_id === null || typeof item.related_entity_id === 'string') &&
    (item.navigation_path === null || typeof item.navigation_path === 'string') &&
    (item.read_at === null || typeof item.read_at === 'string') &&
    typeof item.created_at === 'string'
}

function readFeed(value: unknown): NotificationFeed {
  if (!value || typeof value !== 'object') throw new Error('INVALID_NOTIFICATION_FEED')
  const feed = value as Record<string, unknown>
  if (!Array.isArray(feed.notifications) || !feed.notifications.every(isNotification) ||
    typeof feed.unread_count !== 'number' || !Number.isInteger(feed.unread_count) || feed.unread_count < 0) {
    throw new Error('INVALID_NOTIFICATION_FEED')
  }
  return { notifications: feed.notifications, unread_count: feed.unread_count }
}

function isSafeCustomerPath(path: string | null): path is string {
  return path === '/account' || Boolean(path?.startsWith('/account/'))
}

function notifyFeedChanged() {
  window.dispatchEvent(new Event('customer-notifications-updated'))
}

export function CustomerNotificationBell({ refreshKey }: { refreshKey: string }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadNotifications() {
      try {
        const response = await fetch('/api/notifications?limit=5', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('NOTIFICATION_REQUEST_FAILED')
        setFeed(readFeed(await response.json()))
        setError(false)
      } catch (requestError) {
        if (!(requestError instanceof Error && requestError.name === 'AbortError')) setError(true)
      }
    }
    void loadNotifications()
    return () => controller.abort()
  }, [session, refreshKey])

  useEffect(() => {
    if (!session) return
    async function refresh() {
      try {
        const response = await fetch('/api/notifications?limit=5', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (!response.ok) return
        setFeed(readFeed(await response.json()))
        setError(false)
      } catch {
        setError(true)
      }
    }
    window.addEventListener('customer-notifications-updated', refresh)
    return () => window.removeEventListener('customer-notifications-updated', refresh)
  }, [session])

  async function openNotification(notification: Notification) {
    if (!session) return
    if (!notification.read_at) {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notification.id)}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (response.ok) {
        setFeed((current) => current ? {
          notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item),
          unread_count: Math.max(0, current.unread_count - 1),
        } : current)
      }
    }
    if (isSafeCustomerPath(notification.navigation_path)) navigate(notification.navigation_path)
  }

  return (
    <details className="group relative">
      <summary className="relative grid size-11 cursor-pointer list-none place-items-center rounded-full border border-slate-900/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(238,241,247,0.76))] text-slate-700 shadow-[0_4px_14px_rgba(16,24,40,0.06)] transition hover:border-slate-900/15 hover:bg-white hover:text-blue-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" title="Notifications">
        <Bell aria-hidden="true" size={18} strokeWidth={1.8} />
        <span className="sr-only">Open notifications{feed?.unread_count ? `, ${feed.unread_count} unread` : ''}</span>
        {feed?.unread_count ? <span className="absolute -top-0.5 -right-0.5 grid min-h-4 min-w-4 place-items-center rounded-full border border-white bg-blue-600 px-1 text-[9px] font-bold text-white">{feed.unread_count > 99 ? '99+' : feed.unread_count}</span> : null}
      </summary>
      <div className="fixed inset-x-4 top-[4.5rem] z-50 max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-[16px] border border-slate-900/10 bg-white/95 shadow-2xl backdrop-blur-xl md:absolute md:inset-x-auto md:top-auto md:left-0 md:mt-2 md:w-[min(22rem,calc(100vw-2rem))]">
        <div className="flex items-center justify-between border-b border-slate-900/8 px-4 py-3">
          <div><p className="font-semibold text-slate-950">Notifications</p><p className="text-xs text-slate-500">Account and service updates</p></div>
          <Link className="text-xs font-semibold text-blue-700 hover:text-blue-600" to="/account/notifications">View all</Link>
        </div>
        {error ? <p className="p-4 text-sm text-red-700">Notifications could not be loaded.</p> : !feed ? <p className="p-4 text-sm text-slate-500">Loading notifications…</p> : feed.notifications.length === 0 ? <p className="p-4 text-sm text-slate-500">You have no notifications yet.</p> : (
          <ul className="max-h-96 divide-y divide-slate-900/8 overflow-y-auto">
            {feed.notifications.map((notification) => <li key={notification.id}><button className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${notification.read_at ? '' : 'bg-blue-50/70'}`} onClick={() => void openNotification(notification)} type="button"><span className="block text-sm font-semibold text-slate-950">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{notification.message}</span><time className="mt-1 block text-[11px] text-slate-400" dateTime={notification.created_at}>{timestampFormatter.format(new Date(notification.created_at))}</time></button></li>)}
          </ul>
        )}
      </div>
    </details>
  )
}

export function CustomerNotificationsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function loadNotifications() {
      try {
        const response = await fetch('/api/notifications?limit=100', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('NOTIFICATION_REQUEST_FAILED')
        setFeed(readFeed(await response.json()))
        setError(null)
      } catch (requestError) {
        if (!(requestError instanceof Error && requestError.name === 'AbortError')) setError('We could not load your notifications. Please try again later.')
      }
    }
    void loadNotifications()
    return () => controller.abort()
  }, [session])

  async function markRead(notification: Notification) {
    if (!session) return
    if (!notification.read_at) {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) { setError('We could not update this notification.'); return }
      setFeed((current) => current ? { notifications: current.notifications.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item), unread_count: Math.max(0, current.unread_count - 1) } : current)
      notifyFeedChanged()
    }
    if (isSafeCustomerPath(notification.navigation_path)) navigate(notification.navigation_path)
  }

  async function markAllRead() {
    if (!session || saving || !feed?.unread_count) return
    setSaving(true); setError(null)
    try {
      const response = await fetch('/api/notifications/read-all', { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}` } })
      if (!response.ok) throw new Error('MARK_ALL_FAILED')
      const readAt = new Date().toISOString()
      setFeed((current) => current ? { notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at ?? readAt })), unread_count: 0 } : current)
      notifyFeedChanged()
    } catch { setError('We could not mark your notifications as read.') } finally { setSaving(false) }
  }

  return <section className="w-full max-w-4xl"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.14em] text-blue-600 uppercase">Customer portal</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Notifications</h1><p className="mt-2 text-sm text-slate-600">Important account, service, and support updates.</p></div>{feed?.unread_count ? <button className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-slate-900/10 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:text-blue-700 disabled:opacity-60" disabled={saving} onClick={() => void markAllRead()} type="button"><CheckCheck aria-hidden="true" size={17} />{saving ? 'Updating…' : 'Mark all as read'}</button> : null}</header><div className="mt-7">{error && !feed ? <ErrorPanel message={error} title="Notifications unavailable" /> : !feed ? <PageSkeleton count={5} type="list" /> : feed.notifications.length === 0 ? <EmptyState description="Important account and service updates will appear here." title="No notifications yet" /> : <div className="overflow-hidden rounded-[18px] border border-slate-900/8 bg-white shadow-[0_18px_50px_rgba(18,25,38,0.06)]">{error ? <p className="border-b border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p> : null}<ul className="divide-y divide-slate-900/8">{feed.notifications.map((notification) => <li key={notification.id}><button className={`flex w-full items-start gap-4 p-5 text-left transition hover:bg-slate-50 sm:p-6 ${notification.read_at ? '' : 'bg-blue-50/50'}`} onClick={() => void markRead(notification)} type="button"><span aria-hidden="true" className={`mt-1 size-2.5 shrink-0 rounded-full ${notification.read_at ? 'bg-slate-200' : 'bg-blue-600'}`} /><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-950">{notification.title}</span><span className="mt-1 block text-sm leading-6 text-slate-600">{notification.message}</span><time className="mt-2 block text-xs text-slate-400" dateTime={notification.created_at}>{timestampFormatter.format(new Date(notification.created_at))}</time></span>{isSafeCustomerPath(notification.navigation_path) ? <span aria-hidden="true" className="text-slate-400">→</span> : null}</button></li>)}</ul></div>}</div></section>
}
