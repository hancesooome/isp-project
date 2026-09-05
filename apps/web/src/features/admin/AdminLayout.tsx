import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'

const adminNavItems = [
  { label: 'Overview', to: '/admin', end: true, icon: 'overview' },
  { label: 'Applications', to: '/admin/applications', end: false, icon: 'applications' },
  { label: 'Customers', to: '/admin/customers', end: false, icon: 'customers' },
  { label: 'Plans', to: '/admin/plans', end: false, icon: 'plans' },
  { label: 'Coverage', to: '/admin/coverage', end: false, icon: 'coverage' },
  { label: 'Subscriptions', mobileLabel: 'Subs', to: '/admin/subscriptions', end: false, icon: 'subscriptions' },
  { label: 'Plan changes', mobileLabel: 'Changes', to: '/admin/plan-changes', end: false, icon: 'planChanges' },
  { label: 'Billing', to: '/admin/billing', end: false, icon: 'billing' },
  { label: 'Support', to: '/admin/support', end: false, icon: 'support' },
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

function SignOutIcon() {
  return <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16"><path d="M10 17l5-5-5-5M15 12H3M14 3h4a3 3 0 013 3v12a3 3 0 01-3 3h-4" /></svg>
}

function AdminIcon({ active, name }: { active: boolean; name: string }) {
  const commonProps = {
    'aria-hidden': true,
    fill: 'none',
    height: 17,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: active ? 2 : 1.7,
    viewBox: '0 0 24 24',
    width: 17,
  }

  const paths: Record<string, ReactNode> = {
    overview: <><rect height="7" rx="1" width="7" x="3" y="3" /><rect height="7" rx="1" width="7" x="14" y="3" /><rect height="7" rx="1" width="7" x="3" y="14" /><rect height="7" rx="1" width="7" x="14" y="14" /></>,
    applications: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5M10 13h5M10 17h5" /></>,
    customers: <><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></>,
    plans: <><path d="M5 12.55a11 11 0 0114.08 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" /></>,
    coverage: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
    subscriptions: <><rect height="16" rx="2" width="18" x="3" y="4" /><path d="M7 8h10M7 12h7M7 16h4" /></>,
    planChanges: <><path d="M7 7h11l-3-3M18 7l-3 3" /><path d="M17 17H6l3 3M6 17l3-3" /></>,
    billing: <><rect height="15" rx="2" width="18" x="3" y="5" /><path d="M3 10h18M7 15h3M15 15h2" /></>,
    support: <><path d="M21 12a8 8 0 01-8 8H8l-5 2 2-5a8 8 0 1116-5z" /><path d="M9.5 9a2.5 2.5 0 014.8.9c0 1.8-2.3 2-2.3 3.6M12 17h.01" /></>,
    reports: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  }

  return <svg {...commonProps}>{paths[name]}</svg>
}
