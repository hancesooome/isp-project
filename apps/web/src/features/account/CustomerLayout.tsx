import { useEffect, useMemo, useState } from 'react'
import { CircleHelp, ClipboardList, FileText, History, House, LogOut, MessageCircle, ReceiptText, Wifi, Wrench } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'

type CustomerCapability = 'overview' | 'apply' | 'application' | 'installation' |
  'internet' | 'billing' | 'invoices' | 'statements' | 'payments' |
  'planChanges' | 'cancellation' | 'serviceHistory' | 'support' | 'account'
interface CustomerEntitlements { accessLevel: string; capabilities: CustomerCapability[] }

const navItems = [
  { label: 'Overview', shortLabel: 'Overview', to: '/account', end: true, icon: 'overview', capability: 'overview' },
  { label: 'Get connected', shortLabel: 'Apply', to: '/availability', end: false, icon: 'apply', capability: 'apply' },
  { label: 'Application Status', shortLabel: 'Application', to: '/account/application', end: false, icon: 'application', capability: 'application' },
  { label: 'Installation', shortLabel: 'Install', to: '/account/installation', end: false, icon: 'installation', capability: 'installation' },
  { label: 'Invoices', shortLabel: 'Invoices', to: '/account/invoices', end: false, icon: 'invoices', capability: 'invoices' },
  { label: 'Statements', shortLabel: 'Statements', to: '/account/statements', end: false, icon: 'statements', capability: 'statements' },
  { label: 'Service History', shortLabel: 'History', to: '/account/service-history', end: false, icon: 'history', capability: 'serviceHistory' },
  { label: 'Support', shortLabel: 'Support', to: '/account/support', end: false, icon: 'support', capability: 'support' },
  { label: 'Help Center', shortLabel: 'Help', to: '/account/help', end: false, icon: 'help', capability: 'support' },
] as const

export function CustomerLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { session, user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [entitlements, setEntitlements] = useState<CustomerEntitlements | null>(null)
  const [entitlementError, setEntitlementError] = useState(false)
  const email = user?.email ?? null

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadEntitlements() {
      try {
        const headers = { Authorization: `Bearer ${session?.access_token ?? ''}` }
        const response = await fetch('/api/customer/entitlements', { headers, signal: controller.signal })
        if (!response.ok) throw new Error('ENTITLEMENTS_REQUEST_FAILED')
        const result: unknown = await response.json()
        setEntitlements(readEntitlements(result))
        setEntitlementError(false)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setEntitlements({ accessLevel: 'account_only', capabilities: ['overview', 'support', 'account'] })
        setEntitlementError(true)
      }
    }

    void loadEntitlements()
    return () => controller.abort()
  }, [pathname, session])

  const visibleNavItems = useMemo(
    () => entitlements ? navItems.filter((item) => entitlements.capabilities.includes(item.capability)) : [],
    [entitlements],
  )
  const mobileNavItems = visibleNavItems.filter((item) => item.icon !== 'help')
  const requiredCapability = getRouteCapability(pathname)
  const canViewRoute = entitlements !== null &&
    (requiredCapability === null || entitlements.capabilities.includes(requiredCapability))

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    setSignOutError(null)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/', { replace: true })
    } catch {
      setSignOutError('We could not sign you out. Please try again.')
      setIsSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#111318]">
      {signOutError ? (
        <p role="alert" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl border border-red-300 p-4 shadow-lg bg-white text-red-700">
          {signOutError}
        </p>
      ) : null}
      <aside
        aria-label="Customer portal navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-900/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(238,241,247,0.94))] px-3 py-4 text-slate-950 shadow-[8px_0_30px_rgba(2,6,23,0.12)] md:flex"
      >
        <PortalBrand />
        <p className="px-3 pt-8 pb-3 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Customer portal
        </p>
        <PortalNavigation items={visibleNavItems} loading={entitlements === null} />
        <AccountPanel
          email={email}
          isSigningOut={isSigningOut}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-900/8 bg-[rgba(255,255,255,0.82)] px-4 backdrop-blur-xl md:hidden">
          <PortalBrand compact />
          <div className="flex items-center gap-2">
            {entitlements?.capabilities.includes('support') ? <Link className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/account/help">Help</Link> : null}
          <details className="group relative">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-[10px] border border-slate-900/10 bg-white/70 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <span className="sr-only">Open account menu</span>
              <span aria-hidden="true">{getInitial(email)}</span>
            </summary>
            <div className="absolute right-0 mt-2 w-72 rounded-[14px] border border-slate-900/10 bg-white p-3 shadow-2xl">
              <p className="px-2 text-xs font-medium text-slate-500">Signed in as</p>
              <p className="mt-1 truncate px-2 text-sm font-semibold text-slate-950" title={email ?? undefined}>
                {email ?? 'Customer account'}
              </p>
              <button
                className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
                type="button"
              >
                <SignOutIcon />
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </details>
          </div>
        </header>

        <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(71,118,255,0.07),transparent_28%),#f7f8fb] px-4 pt-8 pb-28 sm:px-6 md:px-8 md:py-10 lg:px-12">
          <div className="customer-portal-content mx-auto max-w-6xl">
            {entitlementError ? <p className="mb-6 rounded-[10px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">Some account options could not be loaded. Refresh the page to try again.</p> : null}
            {entitlements === null ? <PortalLoading /> : canViewRoute ? <Outlet /> : <UnavailablePage />}
          </div>
        </main>

        <nav
          aria-label="Customer portal mobile navigation"
          className="fixed inset-x-3 bottom-3 z-20 grid auto-cols-[4.75rem] grid-flow-col overflow-x-auto rounded-[16px] border border-slate-900/10 bg-[rgba(255,255,255,0.92)] p-1.5 shadow-2xl backdrop-blur-xl md:hidden"
        >
          {mobileNavItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive ? 'bg-slate-100 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                }`
              }
              end={item.end}
              key={item.to}
              to={item.to}
            >
              {({ isActive }) => (
                <>
                  <NavIcon active={isActive} name={item.icon} />
                  <span>{item.shortLabel}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

function PortalBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? '' : 'px-2 py-1'}`}>
      <span aria-hidden="true" className="relative grid size-9 place-items-center rounded-[10px] bg-slate-950 text-white shadow-sm">
        <span className="absolute h-4 w-1 rotate-[-24deg] rounded-full bg-gradient-to-b from-cyan-300 via-blue-500 to-violet-500" />
        <span className="ml-2 h-2.5 w-1 rotate-[-24deg] rounded-full bg-white/90" />
      </span>
      <span className="font-semibold tracking-[-0.02em] text-slate-950">ISP Platform</span>
    </div>
  )
}

function PortalNavigation({ items, loading }: { items: typeof navItems[number][]; loading: boolean }) {
  return (
    <nav aria-label="Customer portal" className="flex-1">
      <ul className="space-y-1" role="list">
        {loading ? <li className="px-3 py-4 text-sm text-slate-500" role="status">Loading navigation...</li> : items.map((item) => (
          <li key={item.to}>
            <NavLink
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? 'border border-white bg-white text-slate-950 shadow-[0_8px_24px_rgba(16,24,40,0.08)]'
                    : 'border border-transparent text-slate-600 hover:bg-white/60 hover:text-slate-950'
                }`
              }
              end={item.end}
              to={item.to}
            >
              {({ isActive }) => (
                <>
                  <NavIcon active={isActive} name={item.icon} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function readEntitlements(value: unknown): CustomerEntitlements {
  if (!value || typeof value !== 'object' || !('entitlements' in value)) throw new Error('INVALID_ENTITLEMENTS_RESPONSE')
  const entitlements = value.entitlements
  if (!entitlements || typeof entitlements !== 'object' || !('accessLevel' in entitlements) ||
    typeof entitlements.accessLevel !== 'string' || !('capabilities' in entitlements) ||
    !Array.isArray(entitlements.capabilities) || !entitlements.capabilities.every(isCustomerCapability)) {
    throw new Error('INVALID_ENTITLEMENTS_RESPONSE')
  }
  return { accessLevel: entitlements.accessLevel, capabilities: entitlements.capabilities }
}

const validCapabilities: readonly string[] = ['overview', 'apply', 'application', 'installation', 'internet', 'billing', 'invoices', 'statements', 'payments', 'planChanges', 'cancellation', 'serviceHistory', 'support', 'account']
function isCustomerCapability(value: unknown): value is CustomerCapability {
  return typeof value === 'string' && validCapabilities.includes(value)
}

function getRouteCapability(pathname: string): CustomerCapability | null {
  const segment = pathname.slice('/account/'.length).split('/')[0]
  const capabilities: Record<string, CustomerCapability> = {
    'application': 'application',
    'installation': 'installation',
    'invoices': 'invoices',
    'statements': 'statements',
    'service-history': 'serviceHistory',
    'plan-changes': 'serviceHistory',
    'change-plan': 'planChanges',
    'cancel-service': 'cancellation',
    'support': 'support',
    'help': 'support',
  }
  return segment ? capabilities[segment] ?? null : 'overview'
}

function PortalLoading() {
  return <div className="space-y-4" aria-label="Loading customer access" role="status"><div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" /><div className="h-48 animate-pulse rounded-[18px] bg-white" /><span className="sr-only">Loading customer access...</span></div>
}

function UnavailablePage() {
  return <section className="mx-auto max-w-xl rounded-[18px] border border-slate-900/8 bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-semibold text-slate-950">This option is not available for your account</h1><p className="mt-3 leading-7 text-slate-600">The available portal sections depend on your current application and internet service status.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-[10px] bg-slate-950 px-5 text-sm font-semibold text-white" to="/account">Return to overview</Link></section>
}

interface AccountPanelProps {
  email: string | null
  isSigningOut: boolean
  onSignOut: () => void
}

function AccountPanel({ email, isSigningOut, onSignOut }: AccountPanelProps) {
  return (
    <div className="rounded-[14px] border border-slate-900/8 bg-white/65 p-3 shadow-sm">
      <div className="flex items-center gap-3 px-1 pb-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-slate-200 text-sm font-semibold text-slate-700">
          {getInitial(email)}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">Customer account</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-950" title={email ?? undefined}>
            {email ?? 'Signed in'}
          </p>
        </div>
      </div>
      <button
        className="flex min-h-11 w-full items-center gap-3 rounded-[10px] border-t border-slate-900/8 px-2 pt-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSigningOut}
        onClick={onSignOut}
        type="button"
      >
        <SignOutIcon />
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}

function getInitial(email: string | null) {
  return email?.trim().charAt(0).toUpperCase() || 'C'
}

function SignOutIcon() { return <LogOut aria-hidden="true" size={17} /> }

function NavIcon({ active, name }: { active: boolean; name: string }) {
  const icons = { overview: House, apply: Wifi, application: ClipboardList, installation: Wrench, invoices: ReceiptText, statements: FileText, history: History, support: MessageCircle, help: CircleHelp }
  const Icon = icons[name as keyof typeof icons] ?? House
  return <Icon aria-hidden="true" size={18} strokeWidth={active ? 2 : 1.75} />
}
