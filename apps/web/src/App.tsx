import type { ReactNode } from 'react'
import { SignupForm } from './features/auth/SignupForm'
import { useAuth } from './features/auth/auth-context'
import { LoginForm } from './features/auth/LoginForm'
import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeRedirect,
} from './features/auth/redirect'

export function App() {
  const { isLoading, session, user } = useAuth()
  const path = window.location.pathname

  function goTo(destination: string) {
    window.location.assign(destination)
  }

  let content: ReactNode

  if (isLoading) {
    content = <p role="status">Loading session…</p>
  } else if (path === '/signup') {
    content = <SignupForm />
  } else if (path === '/forgot-password') {
    content = <PasswordResetPlaceholder />
  } else if (path === DEFAULT_AUTHENTICATED_PATH && session) {
    content = <AuthenticatedPlaceholder email={user?.email ?? ''} />
  } else {
    const requestedRedirect = new URLSearchParams(window.location.search).get(
      'redirect',
    )
    const redirectTo =
      path === DEFAULT_AUTHENTICATED_PATH
        ? DEFAULT_AUTHENTICATED_PATH
        : getSafeRedirect(requestedRedirect)

    content = <LoginForm onSignedIn={goTo} redirectTo={redirectTo} />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      {content}
    </main>
  )
}

function AuthenticatedPlaceholder({ email }: { email: string }) {
  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
        Signed in
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">Account access confirmed</h1>
      <p className="mt-4 text-slate-300">
        {email || 'Your authenticated session is active.'}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        The customer dashboard will be added in a later ticket.
      </p>
    </section>
  )
}

function PasswordResetPlaceholder() {
  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
      <h1 className="text-3xl font-bold text-white">Password reset</h1>
      <p className="mt-4 text-slate-300">
        Password reset will be available in a future ticket.
      </p>
      <a className="mt-6 inline-block font-medium text-sky-400 hover:text-sky-300" href="/login">
        Return to sign in
      </a>
    </section>
  )
}
