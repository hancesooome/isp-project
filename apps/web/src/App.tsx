import React from 'react'
import {
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

import { AdminApplicationReviewPage } from './features/applications/AdminApplicationReviewPage'
import { AdminApplicationsPage } from './features/applications/AdminApplicationsPage'
import { ApplicationStatusPage } from './features/applications/ApplicationStatusPage'
import { ServiceApplicationForm } from './features/applications/ServiceApplicationForm'
import { ServiceAvailabilityPage } from './features/availability/ServiceAvailabilityPage'
import { AdminRoute } from './features/auth/AdminRoute'
import { LoginForm } from './features/auth/LoginForm'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { SignupForm } from './features/auth/SignupForm'
import {
  DEFAULT_AUTHENTICATED_PATH,
  getSafeRedirect,
} from './features/auth/redirect'
import { CustomerLayout } from './features/account/CustomerLayout'
import { AdminLayout } from './features/admin/AdminLayout'
import {
  AdminCustomerDetailsPage,
  AdminCustomersPage,
} from './features/admin/AdminCustomersPage'
import { AdminOverviewPage } from './features/admin/AdminOverviewPage'
import { HomePage } from './features/home/HomePage'
import { AdminBillingPage } from './features/invoices/AdminBillingPage'
import { InvoiceDetailsPage } from './features/invoices/InvoiceDetailsPage'
import { InvoicesPage } from './features/invoices/InvoicesPage'
import { PlansPage } from './features/plans/PlansPage'
import { StatementsPage } from './features/statements/StatementsPage'
import { CustomerDashboard } from './features/subscriptions/CustomerDashboard'
import {
  SupportTicketDetailsPage,
  SupportTicketsPage,
} from './features/support/SupportTicketsPage'
import {
  AdminSupportTicketDetailsPage,
  AdminSupportTicketsPage,
} from './features/support/AdminSupportTicketsPage'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function App() {
  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route element={<LightCentredPage><LoginPage /></LightCentredPage>} path="/login" />
      <Route element={<CentredPage><SignupForm /></CentredPage>} path="/signup" />
      <Route element={<CentredPage><PasswordResetPlaceholder /></CentredPage>} path="/forgot-password" />
      <Route element={<LightCentredPage><ServiceAvailabilityPage /></LightCentredPage>} path="/availability" />
      <Route element={<LightCentredPage><PlansPage /></LightCentredPage>} path="/plans" />
      <Route
        element={
          <ProtectedRoute>
            <CentredPage><ServiceApplicationForm /></CentredPage>
          </ProtectedRoute>
        }
        path="/apply"
      />
      <Route
        element={
          <ProtectedRoute>
            <CustomerLayout />
          </ProtectedRoute>
        }
        path="/account"
      >
        <Route index element={<CustomerDashboard />} />
        <Route path="application" element={<ApplicationStatusPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailsRoute />} />
        <Route path="statements" element={<StatementsPage />} />
        <Route path="support" element={<SupportTicketsPage />} />
        <Route path="support/:id" element={<SupportTicketDetailsRoute />} />
      </Route>
      <Route
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </ProtectedRoute>
        }
        path="/admin"
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="applications" element={<AdminApplicationsPage />} />
        <Route path="applications/:id" element={<AdminApplicationReviewRoute />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="customers/:id" element={<AdminCustomerDetailsRoute />} />
        <Route path="billing" element={<AdminBillingPage />} />
        <Route path="support" element={<AdminSupportTicketsPage />} />
        <Route path="support/:id" element={<AdminSupportTicketDetailsRoute />} />
      </Route>
      <Route element={<CentredPage><NotFoundPage /></CentredPage>} path="*" />
    </Routes>
  )
}

function CentredPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      {children}
    </div>
  )
}

function LightCentredPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f7f8fb] px-5 py-12">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      {children}
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = getSafeRedirect(searchParams.get('redirect'))

  return (
    <LoginForm
      onSignedIn={(destination) => navigate(destination, { replace: true })}
      redirectTo={redirectTo}
    />
  )
}

function InvoiceDetailsRoute() {
  const { id } = useParams()
  return id && uuidPattern.test(id) ? (
    <InvoiceDetailsPage invoiceId={id} />
  ) : (
    <NotFoundPage />
  )
}

function AdminApplicationReviewRoute() {
  const { id } = useParams()
  return id && uuidPattern.test(id) ? (
    <AdminApplicationReviewPage applicationId={id} />
  ) : (
    <NotFoundPage />
  )
}

function AdminCustomerDetailsRoute() {
  const { id } = useParams()
  return id && uuidPattern.test(id) ? (
    <AdminCustomerDetailsPage customerId={id} />
  ) : (
    <NotFoundPage />
  )
}

function SupportTicketDetailsRoute() {
  const { id } = useParams()
  return id && uuidPattern.test(id) ? (
    <SupportTicketDetailsPage ticketId={id} />
  ) : (
    <NotFoundPage />
  )
}

function AdminSupportTicketDetailsRoute() {
  const { id } = useParams()
  return id && uuidPattern.test(id) ? (
    <AdminSupportTicketDetailsPage ticketId={id} />
  ) : (
    <NotFoundPage />
  )
}


function PasswordResetPlaceholder() {
  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
      <Link
        className="mb-4 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
        to="/"
      >
        ← Back to home
      </Link>
      <h1 className="mt-3 text-3xl font-bold text-white">Password reset</h1>
      <p className="mt-4 text-slate-300">
        Password reset will be available in a future ticket.
      </p>
      <Link
        className="mt-6 inline-block font-medium text-sky-400 hover:text-sky-300"
        to="/login"
      >
        Return to sign in
      </Link>
    </section>
  )
}

function NotFoundPage() {
  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
        404
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">Page not found</h1>
      <p className="mt-3 text-slate-400">
        The page you requested does not exist or may have moved.
      </p>
      <div className="mt-6 flex justify-center gap-5">
        <Link className="font-medium text-sky-400 hover:text-sky-300" to="/">
          Go home
        </Link>
        <Link
          className="font-medium text-sky-400 hover:text-sky-300"
          to={DEFAULT_AUTHENTICATED_PATH}
        >
          View account
        </Link>
      </div>
    </section>
  )
}
