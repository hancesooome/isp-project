import type { ReactNode } from 'react'
import { ServiceAvailabilityPage } from './features/availability/ServiceAvailabilityPage'
import { ServiceApplicationForm } from './features/applications/ServiceApplicationForm'
import { ApplicationStatusPage } from './features/applications/ApplicationStatusPage'
import { AdminApplicationsPage } from './features/applications/AdminApplicationsPage'
import { AdminApplicationReviewPage } from './features/applications/AdminApplicationReviewPage'
import { SignupForm } from './features/auth/SignupForm'
import { AdminRoute } from './features/auth/AdminRoute'
import { LoginForm } from './features/auth/LoginForm'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { PlansPage } from './features/plans/PlansPage'
import { CustomerDashboard } from './features/subscriptions/CustomerDashboard'
import { InvoicesPage } from './features/invoices/InvoicesPage'
import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeRedirect,
} from './features/auth/redirect'

export function App() {
  const path = window.location.pathname
  const adminApplicationMatch = path.match(
    /^\/admin\/applications\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
  )

  function goTo(destination: string) {
    window.location.assign(destination)
  }

  let content: ReactNode

  if (path === '/signup') {
    content = <SignupForm />
  } else if (path === '/forgot-password') {
    content = <PasswordResetPlaceholder />
  } else if (path === '/availability') {
    content = <ServiceAvailabilityPage />
  } else if (path === '/plans') {
    content = <PlansPage />
  } else if (path === '/apply') {
    content = (
      <ProtectedRoute>
        <ServiceApplicationForm />
      </ProtectedRoute>
    )
  } else if (path === '/account/application') {
    content = (
      <ProtectedRoute>
        <ApplicationStatusPage />
      </ProtectedRoute>
    )
  } else if (path === '/account/invoices') {
    content = (
      <ProtectedRoute>
        <InvoicesPage />
      </ProtectedRoute>
    )
  } else if (path === '/admin') {
    content = (
      <ProtectedRoute>
        <AdminRoute>
          <AdminPlaceholder />
        </AdminRoute>
      </ProtectedRoute>
    )
  } else if (path === '/admin/applications') {
    content = (
      <ProtectedRoute>
        <AdminRoute>
          <AdminApplicationsPage />
        </AdminRoute>
      </ProtectedRoute>
    )
  } else if (adminApplicationMatch?.[1]) {
    content = (
      <ProtectedRoute>
        <AdminRoute>
          <AdminApplicationReviewPage
            applicationId={adminApplicationMatch[1]}
          />
        </AdminRoute>
      </ProtectedRoute>
    )
  } else if (path === DEFAULT_AUTHENTICATED_PATH) {
    content = (
      <ProtectedRoute>
        <CustomerDashboard />
      </ProtectedRoute>
    )
  } else {
    const requestedRedirect = new URLSearchParams(window.location.search).get(
      'redirect',
    )
    const redirectTo = getSafeRedirect(requestedRedirect)

    content = <LoginForm onSignedIn={goTo} redirectTo={redirectTo} />
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      {content}
    </main>
  )
}

function AdminPlaceholder() {
  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
        Admin
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">
        Admin access confirmed
      </h1>
      <p className="mt-3 text-slate-400">
        Admin features will be added in later tickets.
      </p>
      <a
        className="mt-6 inline-block rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400"
        href="/admin/applications"
      >
        View service applications
      </a>
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
      <a
        className="mt-6 inline-block font-medium text-sky-400 hover:text-sky-300"
        href="/login"
      >
        Return to sign in
      </a>
    </section>
  )
}
