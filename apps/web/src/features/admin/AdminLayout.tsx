import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { supabase } from '../../lib/supabase'

const adminNavItems = [
  { label: 'Admin Overview', to: '/admin', end: true },
  { label: 'Applications', to: '/admin/applications', end: false },
  { label: 'Billing', to: '/admin/billing', end: false },
]

export function AdminLayout() {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // Close mobile menu on Escape
  useEffect(() => {
    if (!menuOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    await supabase.auth.signOut()
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        aria-label="Admin navigation"
        className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 md:border-r md:border-slate-800 md:bg-slate-900"
      >
        <AdminSidebarContent
          email={user?.email ?? null}
          isSigningOut={isSigningOut}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      {/* Mobile overlay */}
      {menuOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={closeMenu}
        />
      )}

      {/* Mobile drawer */}
      <aside
        aria-hidden={!menuOpen}
        aria-label="Admin navigation"
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 ease-in-out md:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        id="mobile-admin-nav"
      >
        <AdminSidebarContent
          email={user?.email ?? null}
          isSigningOut={isSigningOut}
          onNavClick={closeMenu}
          onSignOut={() => void handleSignOut()}
        />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col md:ml-64">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 md:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-white">
              NetPulse ISP
            </span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
              Admin
            </span>
          </div>
          <button
            aria-controls="mobile-admin-nav"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close admin navigation menu' : 'Open admin navigation menu'}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
            id="mobile-admin-menu-button"
            onClick={() => setMenuOpen((prev) => !prev)}
            ref={menuButtonRef}
            type="button"
          >
            {menuOpen ? (
              <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

interface AdminSidebarContentProps {
  email: string | null
  isSigningOut: boolean
  onSignOut: () => void
  onNavClick?: () => void
}

function AdminSidebarContent({
  email,
  isSigningOut,
  onSignOut,
  onNavClick,
}: AdminSidebarContentProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Brand & Admin Badge */}
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <span className="text-lg font-bold tracking-tight text-white">
          NetPulse{' '}
          <span className="font-normal text-sky-400">ISP</span>
        </span>
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
          Admin
        </span>
      </div>

      {/* Nav links */}
      <nav aria-label="Admin navigation" className="flex-1 px-3 pb-4">
        <ul className="space-y-1" role="list">
          {adminNavItems.map(({ label, to, end }) => (
            <li key={to}>
              <NavLink
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 font-semibold'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
                end={end}
                onClick={onNavClick}
                to={to}
              >
                {({ isActive }) => (
                  <>
                    <AdminNavIcon label={label} />
                    <span aria-current={isActive ? 'page' : undefined}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer: email + sign out */}
      <div className="shrink-0 border-t border-slate-800 px-3 py-4">
        {email && (
          <p
            className="mb-3 truncate px-3 text-xs text-slate-500"
            title={email}
          >
            {email}
          </p>
        )}
        <button
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSigningOut}
          onClick={onSignOut}
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isSigningOut ? 'Signing out\u2026' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

function AdminNavIcon({ label }: { label: string }) {
  switch (label) {
    case 'Admin Overview':
      return (
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
          <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'Applications':
      return (
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'Billing':
      return (
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
          <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}
