import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
const navigation = [
  { to: '/', label: 'Home' },
  { to: '/plans', label: 'Plans' },
  { to: '/availability', label: 'Coverage' },
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
        <p className="mx-auto mt-8 max-w-7xl border-t border-slate-900/10 pt-6 text-sm text-slate-500">&copy; {new Date().getFullYear()} ISP Platform</p>
      </footer>
    </div>
  )
}

function PublicHeader() {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  function links() {
    return navigation.map(({ to, label }) => (
      <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
        className={({ isActive }) => `inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-medium transition ${isActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'} ${focusClass}`}>
        {label}
      </NavLink>
    ))
  }
  return (
    <header className="relative z-20 px-4 pt-4 sm:px-6 lg:px-8" onKeyDown={(event) => {
      if (event.key === 'Escape' && open) {
        setOpen(false)
        menuButton.current?.focus()
      }
    }}>
      <div className="public-glass mx-auto max-w-7xl rounded-[14px] px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <nav aria-label="Public navigation" className="hidden items-center gap-1 md:flex">{links()}</nav>
          <div className="hidden items-center gap-2 md:flex"><AccountLinks /></div>
          <button ref={menuButton} type="button" aria-expanded={open} aria-controls="public-mobile-navigation"
            onClick={() => setOpen(!open)}
            className={`inline-flex min-h-11 items-center rounded-[10px] border border-slate-900/10 bg-white/70 px-3 text-sm font-semibold md:hidden ${focusClass}`}>
            {open ? 'Close menu' : 'Menu'}
          </button>
        </div>
        {open ? (
          <nav id="public-mobile-navigation" aria-label="Mobile public navigation" className="mt-3 grid gap-1 border-t border-slate-900/10 pt-3 md:hidden">
            {links()}
            <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-900/10 pt-3"><AccountLinks /></div>
          </nav>
        ) : null}
      </div>
    </header>
  )
}

function AccountLinks() {
  const { session, isLoading } = useAuth()
  if (isLoading) return <span className="px-4 text-sm text-slate-500" role="status">Loading account...</span>
  if (session) return <Link to="/account" className={`inline-flex min-h-11 items-center rounded-[10px] bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 ${focusClass}`}>My account</Link>
  return (
    <>
      <Link to="/login" className={`inline-flex min-h-11 items-center rounded-[10px] px-4 text-sm font-semibold text-slate-700 hover:bg-white ${focusClass}`}>Sign in</Link>
      <Link to="/signup" className={`inline-flex min-h-11 items-center rounded-[10px] bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 ${focusClass}`}>Create account</Link>
    </>
  )
}

function Brand() {
  return <Link className={`inline-flex items-center gap-2.5 rounded-md font-semibold tracking-[-0.02em] text-slate-950 ${focusClass}`} to="/"><span aria-hidden="true" className="relative grid size-8 place-items-center rounded-[9px] bg-slate-950 text-white"><span className="absolute h-3.5 w-1 rotate-[-24deg] rounded-full bg-gradient-to-b from-cyan-300 via-blue-500 to-violet-500" /><span className="ml-2 h-2 w-1 rotate-[-24deg] rounded-full bg-white/90" /></span><span>ISP Platform</span></Link>
}
