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
import { HomePage } from './features/home/HomePage'
import { AdminBillingPage } from './features/invoices/AdminBillingPage'
import { InvoiceDetailsPage } from './features/invoices/InvoiceDetailsPage'
import { InvoicesPage } from './features/invoices/InvoicesPage'
import { PlansPage } from './features/plans/PlansPage'
import { StatementsPage } from './features/statements/StatementsPage'
import { CustomerDashboard } from './features/subscriptions/CustomerDashboard'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<LoginPage />} path="/login" />
        <Route element={<SignupForm />} path="/signup" />
        <Route element={<PasswordResetPlaceholder />} path="/forgot-password" />
        <Route element={<ServiceAvailabilityPage />} path="/availability" />
        <Route element={<PlansPage />} path="/plans" />
        <Route
          element={
            <ProtectedRoute>
              <ServiceApplicationForm />
            </ProtectedRoute>
          }
          path="/apply"
        />
        <Route
          element={
            <ProtectedRoute>
              <CustomerDashboard />
            </ProtectedRoute>
          }
          path="/account"
        />
        <Route
          element={
            <ProtectedRoute>
              <ApplicationStatusPage />
            </ProtectedRoute>
          }
          path="/account/application"
        />
        <Route
          element={
            <ProtectedRoute>
              <InvoicesPage />
            </ProtectedRoute>
          }
          path="/account/invoices"
        />
        <Route
          element={
            <ProtectedRoute>
              <InvoiceDetailsRoute />
            </ProtectedRoute>
          }
          path="/account/invoices/:id"
        />
        <Route
          element={
            <ProtectedRoute>
              <StatementsPage />
            </ProtectedRoute>
          }
          path="/account/statements"
        />
        <Route
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminPlaceholder />
              </AdminRoute>
            </ProtectedRoute>
          }
          path="/admin"
        />
        <Route
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminApplicationsPage />
              </AdminRoute>
            </ProtectedRoute>
          }
          path="/admin/applications"
        />
        <Route
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminApplicationReviewRoute />
              </AdminRoute>
            </ProtectedRoute>
          }
          path="/admin/applications/:id"
        />
        <Route
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminBillingPage />
              </AdminRoute>
            </ProtectedRoute>
          }
          path="/admin/billing"
        />
        <Route element={<NotFoundPage />} path="*" />
      </Routes>
    </main>
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
      <Link
        className="mt-6 inline-block rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400"
        to="/admin/applications"
      >
        View service applications
      </Link>
      <Link
        className="mt-4 block font-medium text-sky-400 hover:text-sky-300"
        to="/admin/billing"
      >
        Manage billing
      </Link>
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
