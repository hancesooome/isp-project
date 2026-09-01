import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'

const navItems = [
  { label: 'Overview', shortLabel: 'Overview', to: '/account', end: true, icon: 'overview' },
  { label: 'Application Status', shortLabel: 'Application', to: '/account/application', end: false, icon: 'application' },
  { label: 'Invoices', shortLabel: 'Invoices', to: '/account/invoices', end: false, icon: 'invoices' },
  { label: 'Statements', shortLabel: 'Statements', to: '/account/statements', end: false, icon: 'statements' },
] as const

export function CustomerLayout() {
  const { user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const email = user?.email ?? null

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#111318]">
      <aside
        aria-label="Customer portal navigation"
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-900/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(238,241,247,0.94))] px-3 py-4 text-slate-950 shadow-[8px_0_30px_rgba(2,6,23,0.12)] md:flex"
      >
        <PortalBrand />
        <p className="px-3 pt-8 pb-3 text-[11px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Customer portal
        </p>
        <PortalNavigation />
        <AccountPanel
          email={email}
          isSigningOut={isSigningOut}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-900/8 bg-[rgba(255,255,255,0.82)] px-4 backdrop-blur-xl md:hidden">
          <PortalBrand compact />
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
        </header>

        <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(71,118,255,0.07),transparent_28%),#f7f8fb] px-4 pt-8 pb-28 sm:px-6 md:px-8 md:py-10 lg:px-12">
          <div className="customer-portal-content mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>

        <nav
          aria-label="Customer portal mobile navigation"
          className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-4 rounded-[16px] border border-slate-900/10 bg-[rgba(255,255,255,0.92)] p-1.5 shadow-2xl backdrop-blur-xl md:hidden"
        >
          {navItems.map((item) => (
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

function PortalNavigation() {
  return (
    <nav aria-label="Customer portal" className="flex-1">
      <ul className="space-y-1" role="list">
        {navItems.map((item) => (
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

function SignOutIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="17">
      <path d="M10 17l5-5-5-5M15 12H3M14 3h4a3 3 0 013 3v12a3 3 0 01-3 3h-4" />
    </svg>
  )
}

function NavIcon({ active, name }: { active: boolean; name: string }) {
  const commonProps = {
    'aria-hidden': true,
    fill: 'none',
    height: 18,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: active ? 2 : 1.7,
    viewBox: '0 0 24 24',
    width: 18,
  }

  const paths: Record<string, ReactNode> = {
    overview: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    application: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5M10 13h5M10 17h5" /></>,
    invoices: <><rect height="15" rx="2" width="18" x="3" y="5" /><path d="M3 10h18M7 15h3" /></>,
    statements: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  }

  return <svg {...commonProps}>{paths[name]}</svg>
}
