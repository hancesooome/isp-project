import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'

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

interface ReviewResult {
  id: string
  status: 'approved' | 'rejected'
  reviewed_at: string
  rejection_reason: string | null
}

interface AdminApplicationReviewPageProps {
  applicationId: string
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

function isReviewResult(value: unknown): value is ReviewResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const application = value as Record<string, unknown>

  return (
    typeof application.id === 'string' &&
    (application.status === 'approved' || application.status === 'rejected') &&
    typeof application.reviewed_at === 'string' &&
    (typeof application.rejection_reason === 'string' ||
      application.rejection_reason === null)
  )
}

export function AdminApplicationReviewPage({
  applicationId,
}: AdminApplicationReviewPageProps) {
  const { session } = useAuth()
  const [application, setApplication] = useState<
    AdminApplicationDetail | null
  >()
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)

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

        setError(
          'We could not load this application detail. Please try again later.',
        )
      }
    }

    void loadApplication()
    return () => controller.abort()
  }, [applicationId, session])

  async function handleReview(status: 'approved' | 'rejected') {
    if (!session || !application || isReviewing) {
      return
    }

    if (status === 'rejected' && !rejectionReason.trim()) {
      setReviewError('Provide a reason before rejecting this application.')
      return
    }

    setReviewError(null)
    setReviewSuccess(null)
    setIsReviewing(true)

    try {
      const response = await fetch(
        `/api/admin/applications/${encodeURIComponent(application.id)}/review`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status,
            rejection_reason:
              status === 'rejected' ? rejectionReason.trim() : null,
          }),
        },
      )

      if (!response.ok) {
        throw new Error('ADMIN_APPLICATION_REVIEW_FAILED')
      }

      const result: unknown = await response.json()

      if (
        typeof result !== 'object' ||
        result === null ||
        !('application' in result) ||
        !isReviewResult(result.application)
      ) {
        throw new Error('INVALID_APPLICATION_REVIEW_RESPONSE')
      }

      const reviewedApplication = result.application

      setApplication((current) =>
        current
          ? {
              ...current,
              status: reviewedApplication.status,
              reviewed_at: reviewedApplication.reviewed_at,
              rejection_reason: reviewedApplication.rejection_reason,
            }
          : current,
      )
      setReviewSuccess(
        reviewedApplication.status === 'approved'
          ? 'Application approved successfully.'
          : 'Application rejected successfully.',
      )
    } catch {
      setReviewError(
        'We could not review this application. Please try again later.',
      )
    } finally {
      setIsReviewing(false)
    }
  }

  if (error) {
    return <ErrorPanel message={error} title="Application unavailable" />
  }

  if (application === undefined) {
    return <PageSkeleton type="detail" />
  }

  if (application === null) {
    return (
      <EmptyState
        action={<BackLink />}
        description="This application does not exist or is no longer available."
        title="Application not found"
      />
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
          <Detail label="Plan name" value={application.plan?.name} />
          <Detail
            label="Plan description"
            value={application.plan?.description}
          />
        </DetailCard>

        <DetailCard title="Installation">
          <Detail
            label="Installation address"
            value={application.installation_address}
          />
        </DetailCard>

        <DetailCard title="Review information">
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
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white">Review decision</h2>
          <p className="mt-2 text-sm text-slate-400">
            Approve this application or provide a reason before rejecting it.
          </p>

          <label className="mt-5 block text-sm font-medium text-slate-200" htmlFor="rejectionReason">
            Rejection reason
          </label>
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            disabled={isReviewing}
            id="rejectionReason"
            maxLength={500}
            onChange={(event) => {
              setRejectionReason(event.target.value)
              setReviewError(null)
            }}
            placeholder="Required only when rejecting"
            value={rejectionReason}
          />

          {reviewError ? (
            <p className="mt-4 text-sm text-red-300" role="alert">
              {reviewError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-emerald-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isReviewing}
              onClick={() => void handleReview('approved')}
              type="button"
            >
              {isReviewing ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving decision...</span>
                </>
              ) : (
                <span>Approve application</span>
              )}
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-400 px-4 py-3 font-semibold text-red-950 transition hover:bg-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isReviewing}
              onClick={() => void handleReview('rejected')}
              type="button"
            >
              {isReviewing ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving decision...</span>
                </>
              ) : (
                <span>Reject application</span>
              )}
            </button>
          </div>
        </section>
      ) : null}

      {reviewSuccess ? (
        <p className="mt-6 rounded-xl border border-emerald-800 bg-emerald-950/50 p-5 text-center text-emerald-200" role="status">
          {reviewSuccess}
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

function BackLink() {
  return (
    <Link
      className="inline-block font-medium text-sky-400 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
      to="/admin/applications"
    >
      &larr; Back to applications
    </Link>
  )
}
