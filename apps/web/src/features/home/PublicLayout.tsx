import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { BrandLogo } from '../../components/ui/BrandLogo'
import { useAuth } from '../auth/auth-context'

const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
const navigation = [
  { to: '/', label: 'Home' },
  { to: '/plans', label: 'Plans' },
  { to: '/availability', label: 'Coverage' },
  { to: '/help', label: 'Help' },
]

export function PublicLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f8fb] text-[#111318] [color-scheme:light]">
      <a href="#public-content" className="sr-only focus:not-sr-only focus:fixed focus:left-5 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to content</a>
      <PublicHeader key={pathname} />
      <main id="public-content" tabIndex={-1} className={pathname === '/' ? 'flex-1' : 'mx-auto w-full max-w-7xl flex-1 px-5 py-12 sm:px-8 sm:py-16'}>
        <Outlet />
      </main>
      <footer className="border-t border-slate-900/10 px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div>
            <Brand />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">Internet service applications and account management in one clear platform.</p>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-slate-900/10 pt-6 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Conek</p>
          <div className="flex items-center gap-4">
            <Link className={`rounded-md hover:text-slate-950 ${focusClass}`} to="/help">Help center</Link>
            <Link className={`rounded-md hover:text-slate-950 ${focusClass}`} to="/privacy">Privacy policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function PublicHeader() {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        menuButton.current?.focus()
        return
      }

      if (event.key !== 'Tab' || !drawer.current) return
      const focusable = Array.from(
        drawer.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      )
      const first = focusable[0]
      const last = focusable.at(-1)

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function closeMenu(returnFocus = false) {
    setOpen(false)
    if (returnFocus) window.setTimeout(() => menuButton.current?.focus(), 0)
  }

  function links() {
    return navigation.map(({ to, label }) => (
      <NavLink key={to} to={to} end={to === '/'} onClick={() => closeMenu()}
        className={({ isActive }) => `inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-medium transition ${isActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'} ${focusClass}`}>
        {label}
      </NavLink>
    ))
  }
  return (
    <header className="relative z-20 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="public-glass mx-auto max-w-7xl rounded-[14px] px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <nav aria-label="Public navigation" className="hidden items-center gap-1 md:flex">{links()}</nav>
          <div className="hidden items-center gap-2 md:flex"><AccountLinks /></div>
          <button ref={menuButton} type="button" aria-expanded={open} aria-controls="public-mobile-navigation"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            onClick={() => open ? closeMenu(true) : setOpen(true)}
            className={`grid size-11 shrink-0 place-items-center rounded-full border border-slate-900/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(238,241,247,0.78))] text-slate-700 shadow-[0_4px_14px_rgba(16,24,40,0.06)] transition duration-200 hover:border-slate-900/15 hover:bg-white hover:text-slate-950 active:scale-[0.97] motion-reduce:transition-none md:hidden ${focusClass}`}>
            {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 cursor-default bg-slate-950/25 backdrop-blur-[2px]" onClick={() => closeMenu(true)} type="button" />
          <aside ref={drawer} aria-label="Mobile public navigation" aria-modal="true" className="absolute inset-y-0 right-0 flex w-[min(22rem,calc(100vw-1rem))] flex-col border-l border-white/60 bg-[rgba(250,251,253,0.96)] p-5 shadow-[-12px_0_40px_rgba(16,24,40,0.14)] backdrop-blur-xl" id="public-mobile-navigation" role="dialog">
            <div className="flex items-center justify-between gap-3 border-b border-slate-900/8 pb-5">
              <Brand />
              <button ref={closeButton} aria-label="Close navigation" className={`grid size-11 shrink-0 place-items-center rounded-full border border-slate-900/10 bg-white/75 text-slate-700 transition duration-200 hover:bg-white hover:text-slate-950 active:scale-[0.97] motion-reduce:transition-none ${focusClass}`} onClick={() => closeMenu(true)} type="button">
                <X aria-hidden="true" size={20} />
              </button>
            </div>
            <nav aria-label="Mobile public navigation" className="mt-5 grid gap-1">{links()}</nav>
            <div className="mt-auto grid gap-2 border-t border-slate-900/10 pt-5"><AccountLinks onNavigate={() => closeMenu()} /></div>
          </aside>
        </div>
      ) : null}
    </header>
  )
}

function AccountLinks({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { session, isLoading } = useAuth()
  if (isLoading) return <span className="px-4 text-sm text-slate-500" role="status">Loading account...</span>
  if (session) return <Link to="/portal" onClick={onNavigate} className={`inline-flex min-h-11 items-center justify-center rounded-[10px] bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 ${focusClass}`}>Open dashboard</Link>
  return (
    <>
      <Link to="/login" onClick={onNavigate} className={`inline-flex min-h-11 items-center justify-center rounded-[10px] px-4 text-sm font-semibold text-slate-700 hover:bg-white ${focusClass}`}>Sign in</Link>
      <Link to="/signup" onClick={onNavigate} className={`inline-flex min-h-11 items-center justify-center rounded-[10px] bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 ${focusClass}`}>Create account</Link>
    </>
  )
}

function Brand() {
  return <Link className={`inline-flex rounded-md ${focusClass}`} to="/"><BrandLogo className="h-11 w-auto max-w-40" /></Link>
}
