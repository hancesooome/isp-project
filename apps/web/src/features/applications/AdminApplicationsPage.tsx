import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'

interface AdminApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  installation_address: string
  submitted_at: string
  rejection_reason: string | null
  customer: { id: string; full_name: string | null } | null
  plan: { id: string; name: string } | null
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function hasStringProperty(value: object, property: string): boolean {
  return property in value && typeof value[property as keyof object] === 'string'
}

function isAdminApplication(value: unknown): value is AdminApplication {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const application = value as Record<string, unknown>
  const customer = application.customer
  const plan = application.plan

  return (
    typeof application.id === 'string' &&
    (application.status === 'pending' ||
      application.status === 'approved' ||
      application.status === 'rejected') &&
    typeof application.installation_address === 'string' &&
    typeof application.submitted_at === 'string' &&
    (typeof application.rejection_reason === 'string' ||
      application.rejection_reason === null) &&
    (customer === null ||
      (typeof customer === 'object' &&
        hasStringProperty(customer, 'id') &&
        'full_name' in customer &&
        (typeof customer.full_name === 'string' ||
          customer.full_name === null))) &&
    (plan === null ||
      (typeof plan === 'object' &&
        hasStringProperty(plan, 'id') &&
        hasStringProperty(plan, 'name')))
  )
}

export function AdminApplicationsPage() {
  const { session } = useAuth()
  const [applications, setApplications] = useState<AdminApplication[] | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      return
    }

    const controller = new AbortController()

    async function loadApplications() {
      try {
        const response = await fetch('/api/admin/applications', {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('ADMIN_APPLICATIONS_REQUEST_FAILED')
        }

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('applications' in result) ||
          !Array.isArray(result.applications) ||
          !result.applications.every(isAdminApplication)
        ) {
          throw new Error('INVALID_ADMIN_APPLICATIONS_RESPONSE')
        }

        setApplications(result.applications)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load service applications. Please try again later.')
      }
    }

    void loadApplications()
    return () => controller.abort()
  }, [session])

  return (
    <section className="w-full max-w-6xl">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          Service applications
        </h1>
        <p className="mt-3 text-slate-400">
          Review new customer applications and their current status.
        </p>
      </header>

      <div className="mt-8">
        {error ? (
          <ErrorPanel message={error} title="Applications unavailable" />
        ) : applications === null ? (
          <PageSkeleton count={3} type="list" />
        ) : applications.length === 0 ? (
          <EmptyState
            description="No service applications have been submitted by customers yet."
            title="No service applications found"
          />
        ) : (
          <div className="grid gap-4">
            {applications.map((application) => (
              <article
                className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center"
                key={application.id}
              >
                <div>
                  <p className="text-sm text-slate-400">Customer</p>
                  <p className="mt-1 font-semibold text-white">
                    {application.customer?.full_name ?? 'Name unavailable'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Plan</p>
                  <p className="mt-1 text-white">
                    {application.plan?.name ?? 'Plan unavailable'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Submitted</p>
                  <p className="mt-1 text-white">
                    {dateFormatter.format(new Date(application.submitted_at))}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                  <StatusBadge status={application.status} />
                  <Link
                    className="block font-medium text-sky-400 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 sm:mt-3"
                    to={`/admin/applications/${encodeURIComponent(application.id)}`}
                  >
                    Review &rarr;
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
