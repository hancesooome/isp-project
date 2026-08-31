import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { supabase } from '../../lib/supabase'

const navItems = [
  { label: 'Dashboard', to: '/account', end: true },
  { label: 'Application Status', to: '/account/application', end: false },
  { label: 'Invoices', to: '/account/invoices', end: false },
  { label: 'Statements', to: '/account/statements', end: false },
]

export function CustomerLayout() {
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
    // AuthProvider's onAuthStateChange sets session = null,
    // which causes ProtectedRoute to redirect to /login automatically.
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        aria-label="Account navigation"
        className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 md:border-r md:border-slate-800 md:bg-slate-900"
      >
        <SidebarContent
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
        aria-label="Account navigation"
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 ease-in-out md:hidden ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!menuOpen}
        id="mobile-nav"
      >
        <SidebarContent
          email={user?.email ?? null}
          isSigningOut={isSigningOut}
          onSignOut={() => void handleSignOut()}
          onNavClick={closeMenu}
        />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col md:ml-64">
        {/* Mobile top bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 md:hidden">
          <span className="font-semibold tracking-tight text-white">
            NetPulse ISP
          </span>
          <button
            aria-controls="mobile-nav"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
            id="mobile-menu-button"
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

interface SidebarContentProps {
  email: string | null
  isSigningOut: boolean
  onSignOut: () => void
  onNavClick?: () => void
}

function SidebarContent({
  email,
  isSigningOut,
  onSignOut,
  onNavClick,
}: SidebarContentProps) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center px-6">
        <span className="text-lg font-bold tracking-tight text-white">
          NetPulse{' '}
          <span className="font-normal text-sky-400">ISP</span>
        </span>
      </div>

      {/* Nav links */}
      <nav aria-label="Account navigation" className="flex-1 px-3 pb-4">
        <ul className="space-y-1" role="list">
          {navItems.map(({ label, to, end }) => (
            <li key={to}>
              <NavLink
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
                end={end}
                onClick={onNavClick}
                to={to}
              >
                {({ isActive }) => (
                  <>
                    <NavIcon label={label} />
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
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
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

function NavIcon({ label }: { label: string }) {
  switch (label) {
    case 'Dashboard':
      return (
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'Application Status':
      return (
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'Invoices':
      return (
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
          <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'Statements':
      return (
        <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
          <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}
