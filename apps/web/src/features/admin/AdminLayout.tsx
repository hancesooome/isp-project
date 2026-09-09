import { useState } from 'react'
import { ChartNoAxesColumn, CircleHelp, ClipboardList, CreditCard, HardHat, House, Layers, LogOut, MapPinned, MessageCircle, RefreshCw, Repeat2, Users, Wrench, XCircle } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'

const adminNavItems = [
  { label: 'Overview', to: '/admin', end: true, icon: 'overview' },
  { label: 'Applications', to: '/admin/applications', end: false, icon: 'applications' },
  { label: 'Installations', mobileLabel: 'Installs', to: '/admin/installations', end: false, icon: 'installations' },
  { label: 'Technicians', mobileLabel: 'Techs', to: '/admin/technicians', end: false, icon: 'technicians' },
  { label: 'Customers', to: '/admin/customers', end: false, icon: 'customers' },
  { label: 'Plans', to: '/admin/plans', end: false, icon: 'plans' },
  { label: 'Coverage', to: '/admin/coverage', end: false, icon: 'coverage' },
  { label: 'Subscriptions', mobileLabel: 'Subs', to: '/admin/subscriptions', end: false, icon: 'subscriptions' },
  { label: 'Plan changes', mobileLabel: 'Changes', to: '/admin/plan-changes', end: false, icon: 'planChanges' },
  { label: 'Cancellations', mobileLabel: 'Cancel', to: '/admin/cancellations', end: false, icon: 'cancellations' },
  { label: 'Billing', to: '/admin/billing', end: false, icon: 'billing' },
  { label: 'Support', to: '/admin/support', end: false, icon: 'support' },
  { label: 'FAQs', to: '/admin/faqs', end: false, icon: 'faqs' },
  { label: 'Reports', to: '/admin/reports', end: false, icon: 'reports' },
] as const

export function AdminLayout() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const email = user?.email ?? null

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
    <div className="min-h-screen bg-[#0a0d12] text-slate-100">
      {signOutError ? (
        <p role="alert" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl border border-red-300 p-4 shadow-lg bg-slate-900 text-red-300">
          {signOutError}
        </p>
      ) : null}
      <aside
        aria-label="Admin portal navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/8 bg-[linear-gradient(155deg,#11161f,#0a0d12)] px-3 py-4 shadow-[8px_0_30px_rgba(0,0,0,0.2)] md:flex"
      >
        <AdminBrand />
        <div className="mt-7 flex items-center justify-between px-3 pb-2">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Operations</p>
          <span className="rounded-md border border-white/8 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-slate-400 uppercase">Admin</span>
        </div>
        <AdminNavigation />
        <AdminAccountPanel
          email={email}
          isSigningOut={isSigningOut}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      <div className="min-h-screen md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/8 bg-[rgba(10,13,18,0.88)] px-4 backdrop-blur-xl md:hidden">
          <AdminBrand compact />
          <details className="relative">
            <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-[9px] border border-white/10 bg-white/6 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
              <span className="sr-only">Open administrator account menu</span>
              <span aria-hidden="true">{getInitial(email)}</span>
            </summary>
            <div className="absolute right-0 mt-2 w-72 rounded-[12px] border border-white/10 bg-[#161c26] p-3 shadow-2xl">
              <div className="flex items-center justify-between gap-3 px-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">Administrator</p>
                  <p className="mt-1 truncate text-sm font-medium text-white" title={email ?? undefined}>{email ?? 'Admin account'}</p>
                </div>
                <span className="size-2 shrink-0 rounded-full bg-emerald-400">
                  <span className="sr-only">Authenticated</span>
                </span>
              </div>
              <button
                className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-[9px] px-3 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSigningOut}
                onClick={() => void handleSignOut()}
                type="button"
              >
                <SignOutIcon />
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </details>
        </header>

        <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(71,118,255,0.06),transparent_25%),#0a0d12] px-4 pt-6 pb-24 sm:px-6 md:px-8 md:py-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>

        <nav
          aria-label="Admin portal mobile navigation"
          className="fixed inset-x-3 bottom-3 z-20 grid auto-cols-[4.75rem] grid-flow-col overflow-x-auto rounded-[14px] border border-white/10 bg-[rgba(17,22,31,0.94)] p-1 shadow-2xl backdrop-blur-xl md:hidden"
        >
          {adminNavItems.map((item) => (
            <NavLink
              aria-label={item.label}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-[9px] px-2 text-[10px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive ? 'bg-white/9 text-blue-300' : 'text-slate-400 hover:bg-white/6 hover:text-white'
                }`
              }
              end={item.end}
              key={item.to}
              to={item.to}
            >
              {({ isActive }) => <><AdminIcon active={isActive} name={item.icon} /><span>{'mobileLabel' in item ? item.mobileLabel : item.label}</span></>}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? '' : 'px-2 py-1'}`}>
      <span aria-hidden="true" className="relative grid size-8 place-items-center rounded-[9px] border border-white/10 bg-[#161c26] shadow-sm">
        <span className="absolute h-3.5 w-1 rotate-[-24deg] rounded-full bg-gradient-to-b from-cyan-300 via-blue-500 to-violet-500" />
        <span className="ml-2 h-2 w-1 rotate-[-24deg] rounded-full bg-white/90" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-[-0.01em] text-white">ISP Platform</p>
        {compact ? <p className="text-[9px] font-medium tracking-[0.12em] text-slate-500 uppercase">Admin</p> : null}
      </div>
    </div>
  )
}

function AdminNavigation() {
  return (
    <nav aria-label="Admin portal" className="flex-1">
      <ul className="space-y-1" role="list">
        {adminNavItems.map((item) => (
          <li key={item.to}>
            <NavLink
              className={({ isActive }) =>
                `flex min-h-10 items-center gap-3 rounded-[9px] border px-3 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isActive
                    ? 'border-white/8 bg-white/8 text-white shadow-sm'
                    : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`
              }
              end={item.end}
              to={item.to}
            >
              {({ isActive }) => <><AdminIcon active={isActive} name={item.icon} /><span>{item.label}</span></>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

interface AdminAccountPanelProps {
  email: string | null
  isSigningOut: boolean
  onSignOut: () => void
}

function AdminAccountPanel({ email, isSigningOut, onSignOut }: AdminAccountPanelProps) {
  return (
    <div className="rounded-[12px] border border-white/8 bg-white/4 p-3">
      <div className="flex items-center gap-3 pb-3">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-slate-700 text-xs font-semibold text-slate-100">{getInitial(email)}</span>
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-[0.08em] text-slate-500 uppercase">Administrator</p>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-200" title={email ?? undefined}>{email ?? 'Signed in'}</p>
        </div>
      </div>
      <button
        className="flex min-h-10 w-full items-center gap-3 border-t border-white/8 px-1 pt-2 text-xs font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
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
  return email?.trim().charAt(0).toUpperCase() || 'A'
}

function SignOutIcon() { return <LogOut aria-hidden="true" size={16} /> }

function AdminIcon({ active, name }: { active: boolean; name: string }) {
  const icons = { overview: House, applications: ClipboardList, installations: Wrench, technicians: HardHat, customers: Users, plans: Layers, coverage: MapPinned, subscriptions: Repeat2, planChanges: RefreshCw, cancellations: XCircle, billing: CreditCard, support: MessageCircle, faqs: CircleHelp, reports: ChartNoAxesColumn }
  const Icon = icons[name as keyof typeof icons] ?? House
  return <Icon aria-hidden="true" size={17} strokeWidth={active ? 2 : 1.75} />
}
