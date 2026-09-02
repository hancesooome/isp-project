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

type ApplicationFilter = AdminApplication['status'] | 'all'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationFilter>('all')

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

  const statusCounts = {
    all: applications?.length ?? 0,
    pending:
      applications?.filter((application) => application.status === 'pending')
        .length ?? 0,
    approved:
      applications?.filter((application) => application.status === 'approved')
        .length ?? 0,
    rejected:
      applications?.filter((application) => application.status === 'rejected')
        .length ?? 0,
  }
  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredApplications =
    applications?.filter((application) => {
      const matchesStatus =
        statusFilter === 'all' || application.status === statusFilter
      const matchesSearch =
        normalizedSearch.length === 0 ||
        application.id.toLowerCase().includes(normalizedSearch) ||
        application.customer?.full_name
          ?.toLowerCase()
          .includes(normalizedSearch) ||
        application.plan?.name.toLowerCase().includes(normalizedSearch) ||
        application.installation_address.toLowerCase().includes(normalizedSearch)

      return matchesStatus && Boolean(matchesSearch)
    }) ?? []

  return (
    <section className="w-full max-w-7xl">
      <header className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
            Service applications
          </h1>
          <p className="mt-2 text-sm text-slate-400 sm:text-base">
            Review and manage customer service applications.
          </p>
        </div>

        {applications && applications.length > 0 ? (
          <div className="relative w-full lg:max-w-sm">
            <label className="sr-only" htmlFor="applicationSearch">
              Search applications
            </label>
            <SearchIcon />
            <input
              className="min-h-12 w-full rounded-[10px] border border-white/10 bg-[#0d121a] py-3 pr-4 pl-11 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-white/15 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              id="applicationSearch"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search applications..."
              type="search"
              value={searchQuery}
            />
          </div>
        ) : null}
      </header>

      <div className="mt-7">
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
          <div>
            <StatusFilters
              counts={statusCounts}
              onChange={setStatusFilter}
              selected={statusFilter}
            />

            <div className="mt-5 overflow-hidden rounded-[14px] border border-white/10 bg-[rgba(14,18,26,0.78)] shadow-[0_14px_38px_rgba(0,0,0,0.16)]">
              {filteredApplications.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <p className="text-sm font-medium text-slate-200">
                    No matching applications
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try another search or status filter.
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[820px] text-left">
                      <thead className="border-b border-white/8 bg-white/[0.025]">
                        <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          <th className="px-5 py-4" scope="col">Application</th>
                          <th className="px-5 py-4" scope="col">Customer</th>
                          <th className="px-5 py-4" scope="col">Plan</th>
                          <th className="px-5 py-4" scope="col">Submitted</th>
                          <th className="px-5 py-4" scope="col">Status</th>
                          <th className="px-5 py-4 text-right" scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/8">
                        {filteredApplications.map((application) => (
                          <ApplicationTableRow
                            application={application}
                            key={application.id}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="divide-y divide-white/8 md:hidden">
                    {filteredApplications.map((application) => (
                      <ApplicationMobileRow
                        application={application}
                        key={application.id}
                      />
                    ))}
                  </div>

                  <footer className="border-t border-white/8 px-5 py-4 text-xs text-slate-500">
                    Showing {filteredApplications.length} of{' '}
                    {applications.length} applications
                  </footer>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function StatusFilters({
  counts,
  onChange,
  selected,
}: {
  counts: Record<ApplicationFilter, number>
  onChange: (filter: ApplicationFilter) => void
  selected: ApplicationFilter
}) {
  const filters: { label: string; value: ApplicationFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
  ]

  return (
    <div
      aria-label="Filter applications by status"
      className="flex max-w-2xl gap-1 overflow-x-auto rounded-[12px] border border-white/10 bg-[#0d121a] p-1"
      role="group"
    >
      {filters.map((filter) => {
        const isSelected = selected === filter.value

        return (
          <button
            aria-pressed={isSelected}
            className={`flex min-h-10 min-w-max flex-1 items-center justify-center gap-2 rounded-[9px] px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              isSelected
                ? 'bg-white/8 text-white shadow-sm'
                : 'text-slate-400 hover:bg-white/4 hover:text-slate-200'
            }`}
            key={filter.value}
            onClick={() => onChange(filter.value)}
            type="button"
          >
            {filter.label}
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] ${
                isSelected
                  ? 'bg-blue-500/20 text-blue-200'
                  : 'bg-white/6 text-slate-400'
              }`}
            >
              {counts[filter.value]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ApplicationTableRow({
  application,
}: {
  application: AdminApplication
}) {
  return (
    <tr className="transition hover:bg-white/[0.025]">
      <td className="px-5 py-4">
        <p className="font-medium text-slate-100">
          #{application.id.slice(0, 8).toUpperCase()}
        </p>
        <p className="mt-1 max-w-40 truncate text-xs text-slate-500">
          {application.installation_address}
        </p>
      </td>
      <td className="px-5 py-4 text-sm font-medium text-slate-100">
        {application.customer?.full_name ?? 'Name unavailable'}
      </td>
      <td className="px-5 py-4 text-sm text-slate-200">
        {application.plan?.name ?? 'Plan unavailable'}
      </td>
      <td className="px-5 py-4 text-sm text-slate-300">
        {dateFormatter.format(new Date(application.submitted_at))}
      </td>
      <td className="px-5 py-4">
        <StatusBadge status={application.status} />
      </td>
      <td className="px-5 py-4 text-right">
        <ReviewLink applicationId={application.id} />
      </td>
    </tr>
  )
}

function ApplicationMobileRow({
  application,
}: {
  application: AdminApplication
}) {
  return (
    <article className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">
            #{application.id.slice(0, 8).toUpperCase()}
          </p>
          <h2 className="mt-1 truncate font-semibold text-white">
            {application.customer?.full_name ?? 'Name unavailable'}
          </h2>
        </div>
        <StatusBadge className="shrink-0" status={application.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-slate-500">Plan</dt>
          <dd className="mt-1 text-sm text-slate-200">
            {application.plan?.name ?? 'Plan unavailable'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Submitted</dt>
          <dd className="mt-1 text-sm text-slate-200">
            {dateFormatter.format(new Date(application.submitted_at))}
          </dd>
        </div>
      </dl>
      <ReviewLink applicationId={application.id} className="mt-4 w-full" />
    </article>
  )
}

function ReviewLink({
  applicationId,
  className = '',
}: {
  applicationId: string
  className?: string
}) {
  return (
    <Link
      className={`inline-flex min-h-10 items-center justify-center rounded-[9px] border border-blue-400/25 px-3.5 text-sm font-semibold text-blue-300 transition hover:border-blue-400/40 hover:bg-blue-400/8 hover:text-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${className}`}
      to={`/admin/applications/${encodeURIComponent(applicationId)}`}
    >
      Review{' '}
      <span aria-hidden="true" className="ml-2">
        &rarr;
      </span>
    </Link>
  )
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-500"
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width="18"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}
