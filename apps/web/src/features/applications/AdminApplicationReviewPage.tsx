import { useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'

interface AdminApplicationDetail {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  installation_address: string
  submitted_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  customer: {
    id: string
    full_name: string | null
    customer_profile: {
      phone: string | null
      address: string | null
    } | null
  } | null
  plan: {
    id: string
    name: string
    description: string | null
    billing_interval: 'monthly' | 'yearly'
  } | null
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isAdminApplicationDetail(
  value: unknown,
): value is AdminApplicationDetail {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const application = value as Record<string, unknown>
  const customer = application.customer
  const plan = application.plan

  const validCustomer =
    customer === null ||
    (typeof customer === 'object' &&
      'id' in customer &&
      typeof customer.id === 'string' &&
      'full_name' in customer &&
      isNullableString(customer.full_name) &&
      'customer_profile' in customer &&
      (customer.customer_profile === null ||
        (typeof customer.customer_profile === 'object' &&
          'phone' in customer.customer_profile &&
          isNullableString(customer.customer_profile.phone) &&
          'address' in customer.customer_profile &&
          isNullableString(customer.customer_profile.address))))

  const validPlan =
    plan === null ||
    (typeof plan === 'object' &&
      'id' in plan &&
      typeof plan.id === 'string' &&
      'name' in plan &&
      typeof plan.name === 'string' &&
      'description' in plan &&
      isNullableString(plan.description) &&
      'billing_interval' in plan &&
      (plan.billing_interval === 'monthly' ||
        plan.billing_interval === 'yearly'))

  return (
    typeof application.id === 'string' &&
    (application.status === 'pending' ||
      application.status === 'approved' ||
      application.status === 'rejected') &&
    typeof application.installation_address === 'string' &&
    typeof application.submitted_at === 'string' &&
    isNullableString(application.reviewed_at) &&
    isNullableString(application.rejection_reason) &&
    validCustomer &&
    validPlan
  )
}

interface AdminApplicationReviewPageProps {
  applicationId: string
}

export function AdminApplicationReviewPage({
  applicationId,
}: AdminApplicationReviewPageProps) {
  const { session } = useAuth()
  const [application, setApplication] =
    useState<AdminApplicationDetail | null>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      return
    }

    const controller = new AbortController()

    async function loadApplication() {
      try {
        const response = await fetch(
          `/api/admin/applications/${encodeURIComponent(applicationId)}`,
          {
            headers: {
              Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            signal: controller.signal,
          },
        )

        if (response.status === 404) {
          setApplication(null)
          return
        }

        if (!response.ok) {
          throw new Error('ADMIN_APPLICATION_REQUEST_FAILED')
        }

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('application' in result) ||
          !isAdminApplicationDetail(result.application)
        ) {
          throw new Error('INVALID_ADMIN_APPLICATION_RESPONSE')
        }

        setApplication(result.application)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load this application. Please try again later.')
      }
    }

    void loadApplication()
    return () => controller.abort()
  }, [applicationId, session])

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

  if (application === undefined) {
    return <p role="status">Loading application...</p>
  }

  if (application === null) {
    return (
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="text-3xl font-bold text-white">Application not found</h1>
        <p className="mt-3 text-slate-400">
          This application does not exist or is no longer available.
        </p>
        <BackLink />
      </section>
    )
  }

  return (
    <section className="w-full max-w-4xl">
      <BackLink />
      <header className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Admin review
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Service application
          </h1>
          <StatusBadge status={application.status} />
        </div>
        <p className="mt-3 text-slate-400">
          Submitted {dateFormatter.format(new Date(application.submitted_at))}
        </p>
      </header>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <DetailCard title="Customer">
          <Detail label="Name" value={application.customer?.full_name} />
          <Detail
            label="Phone"
            value={application.customer?.customer_profile?.phone}
          />
          <Detail
            label="Current address"
            value={application.customer?.customer_profile?.address}
          />
        </DetailCard>

        <DetailCard title="Selected plan">
          <Detail label="Plan" value={application.plan?.name} />
          <Detail
            label="Billing interval"
            value={application.plan?.billing_interval}
          />
          <Detail label="Description" value={application.plan?.description} />
        </DetailCard>

        <DetailCard title="Installation">
          <Detail
            label="Installation address"
            value={application.installation_address}
          />
        </DetailCard>

        <DetailCard title="Review status">
          <Detail label="Current status" value={application.status} />
          <Detail
            label="Reviewed"
            value={
              application.reviewed_at
                ? dateFormatter.format(new Date(application.reviewed_at))
                : null
            }
          />
          {application.rejection_reason ? (
            <Detail
              label="Rejection reason"
              value={application.rejection_reason}
            />
          ) : null}
        </DetailCard>
      </div>

      {application.status === 'pending' ? (
        <p className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-5 text-center text-slate-400">
          Approval and rejection actions will be added in ISP-021.
        </p>
      ) : null}
    </section>
  )
}

function DetailCard({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <dl className="mt-5 space-y-4">{children}</dl>
    </article>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-slate-100">
        {value || 'Not provided'}
      </dd>
    </div>
  )
}

function StatusBadge({ status }: { status: AdminApplicationDetail['status'] }) {
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

function BackLink() {
  return (
    <a
      className="inline-block font-medium text-sky-400 hover:text-sky-300"
      href="/admin/applications"
    >
      Back to applications
    </a>
  )
}
