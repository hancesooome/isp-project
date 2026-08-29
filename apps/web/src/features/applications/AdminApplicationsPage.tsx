import { useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'

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

  if (error) {
    return (
      <p
        className="w-full max-w-3xl rounded-xl border border-red-900 bg-red-950/50 p-5 text-center text-red-200"
        role="alert"
      >
        {error}
      </p>
    )
  }

  if (applications === null) {
    return <p role="status">Loading service applications...</p>
  }

  return (
    <section className="w-full max-w-6xl">
      <header>
        <a className="text-sm text-sky-400 hover:text-sky-300" href="/admin">
          Back to admin
        </a>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
          Service applications
        </h1>
        <p className="mt-3 text-slate-400">
          Review new customer applications and their current status.
        </p>
      </header>

      {applications.length === 0 ? (
        <p className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-slate-300" role="status">
          No service applications found.
        </p>
      ) : (
        <div className="mt-8 grid gap-4">
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
                <a
                  className="block font-medium text-sky-400 hover:text-sky-300 sm:mt-3"
                  href={`/admin/applications/${encodeURIComponent(application.id)}`}
                >
                  Review
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function StatusBadge({ status }: { status: AdminApplication['status'] }) {
  const styles = {
    pending: 'border-amber-700 bg-amber-950/50 text-amber-200',
    approved: 'border-emerald-700 bg-emerald-950/50 text-emerald-200',
    rejected: 'border-red-800 bg-red-950/50 text-red-200',
  }

  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold capitalize ${styles[status]}`}
    >
      {status}
    </span>
  )
}
