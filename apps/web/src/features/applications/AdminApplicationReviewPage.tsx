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
  const [reviewingStatus, setReviewingStatus] = useState<
    'approved' | 'rejected' | null
  >(null)
  const isReviewing = reviewingStatus !== null

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
    setReviewingStatus(status)

    try {
      const response = await fetch(
        `/api/admin/applications/${encodeURIComponent(application.id)}/review`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            status === 'approved'
              ? { status }
              : { status, rejection_reason: rejectionReason.trim() },
          ),
        },
      )

      if (response.status === 409) {
        const result: unknown = await response.json()
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'This application has already been reviewed.'

        setReviewError(message)
        return
      }

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
      setReviewingStatus(null)
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
    <section className="w-full max-w-6xl">
      <BackLink />
      <header className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">
          Application review
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-white sm:text-4xl">
              Service application
            </h1>
            <p className="mt-2 text-sm text-slate-400 sm:text-base">
              Submitted {dateFormatter.format(new Date(application.submitted_at))}
            </p>
          </div>
          <StatusBadge className="mt-1" status={application.status} />
        </div>
      </header>

      <div className="mt-7 overflow-hidden rounded-[14px] border border-white/8 bg-[#11161f] shadow-[0_12px_35px_rgba(0,0,0,0.16)]">
        <div className="grid lg:grid-cols-2">
          <DetailSection title="Customer information">
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Detail label="Name" value={application.customer?.full_name} />
              <Detail
                label="Phone"
                value={application.customer?.customer_profile?.phone}
              />
              <Detail
                className="sm:col-span-2"
                label="Current address"
                value={application.customer?.customer_profile?.address}
              />
            </dl>
          </DetailSection>

          <DetailSection
            className="border-t border-white/8 lg:border-t-0 lg:border-l"
            title="Service information"
          >
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Detail label="Selected plan" value={application.plan?.name} />
              <Detail
                label="Installation address"
                value={application.installation_address}
              />
              <Detail
                className="sm:col-span-2"
                label="Plan description"
                value={application.plan?.description}
              />
            </dl>
          </DetailSection>
        </div>

        {application.status !== 'pending' ? (
          <DetailSection
            className="border-t border-white/8"
            title="Review information"
          >
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
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
            </dl>
          </DetailSection>
        ) : (
          <section className="border-t border-white/8 bg-white/[0.018] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Review decision
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Approve this application or provide a reason before rejecting
                  it.
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Application ID {application.id.slice(0, 8).toUpperCase()}
              </p>
            </div>

            <label
              className="mt-5 block text-sm font-medium text-slate-200"
              htmlFor="rejectionReason"
            >
              Rejection reason{' '}
              <span className="font-normal text-slate-500">
                (required only when rejecting)
              </span>
            </label>
            <textarea
              className="mt-2 min-h-24 w-full resize-y rounded-[10px] border border-white/10 bg-[#0a0d12] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/15 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
              disabled={isReviewing}
              id="rejectionReason"
              maxLength={500}
              onChange={(event) => {
                setRejectionReason(event.target.value)
                setReviewError(null)
              }}
              placeholder="Explain why the application cannot be approved"
              value={rejectionReason}
            />

            {reviewError ? (
              <p
                className="mt-3 rounded-[10px] border border-red-500/20 bg-red-500/8 px-3.5 py-3 text-sm text-red-200"
                role="alert"
              >
                {reviewError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-red-400/25 bg-red-400/8 px-5 text-sm font-semibold text-red-200 transition hover:border-red-400/40 hover:bg-red-400/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isReviewing}
                onClick={() => void handleReview('rejected')}
                type="button"
              >
                {reviewingStatus === 'rejected' ? (
                  <LoadingSpinner size="sm" />
                ) : null}
                {reviewingStatus === 'rejected'
                  ? 'Saving decision...'
                  : 'Reject application'}
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-blue-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isReviewing}
                onClick={() => void handleReview('approved')}
                type="button"
              >
                {reviewingStatus === 'approved' ? (
                  <LoadingSpinner size="sm" />
                ) : null}
                {reviewingStatus === 'approved'
                  ? 'Saving decision...'
                  : 'Approve application'}
              </button>
            </div>
          </section>
        )}
      </div>

      {reviewSuccess ? (
        <p
          className="mt-5 rounded-[12px] border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          {reviewSuccess}
        </p>
      ) : null}
    </section>
  )
}

function DetailSection({
  children,
  className = '',
  title,
}: {
  children: React.ReactNode
  className?: string
  title: string
}) {
  return (
    <section className={`p-5 sm:p-6 ${className}`}>
      <h2 className="mb-5 text-base font-semibold text-white">{title}</h2>
      {children}
    </section>
  )
}

function Detail({
  className = '',
  label,
  value,
}: {
  className?: string
  label: string
  value?: string | null
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-slate-100">
        {value || 'Not provided'}
      </dd>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      className="inline-flex min-h-10 items-center text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      to="/admin/applications"
    >
      <span aria-hidden="true" className="mr-2">
        &larr;
      </span>
      Back to applications
    </Link>
  )
}
