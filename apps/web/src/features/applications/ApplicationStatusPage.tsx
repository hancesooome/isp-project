import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { buttonClassName } from '../../components/ui/button-styles'
import { CustomerPageHeader } from '../account/CustomerPageHeader'
import { CustomerServiceProgress } from './CustomerServiceProgress'

interface CustomerApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  rejection_reason: string | null
  plan: { name: string } | null
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function isCustomerApplication(value: unknown): value is CustomerApplication {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const application = value as Record<string, unknown>
  const plan = application.plan

  return (
    typeof application.id === 'string' &&
    (application.status === 'pending' ||
      application.status === 'approved' ||
      application.status === 'rejected') &&
    typeof application.submitted_at === 'string' &&
    (typeof application.rejection_reason === 'string' ||
      application.rejection_reason === null) &&
    (plan === null ||
      (typeof plan === 'object' &&
        plan !== null &&
        'name' in plan &&
        typeof plan.name === 'string'))
  )
}

export function ApplicationStatusPage() {
  const { session } = useAuth()
  const [application, setApplication] = useState<CustomerApplication | null>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      return
    }

    const controller = new AbortController()

    async function loadApplication() {
      try {
        const response = await fetch('/api/applications/current', {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('APPLICATION_REQUEST_FAILED')
        }

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('application' in result) ||
          (result.application !== null &&
            !isCustomerApplication(result.application))
        ) {
          throw new Error('INVALID_APPLICATION_RESPONSE')
        }

        setApplication(result.application)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') {
          return
        }

        setError('We could not load your application. Please try again later.')
      }
    }

    void loadApplication()
    return () => controller.abort()
  }, [session])

  if (error) {
    return <ErrorPanel message={error} title="Application unavailable" />
  }

  if (application === undefined) {
    return <PageSkeleton type="detail" />
  }

  if (application === null) {
    return (
      <EmptyState
        action={
          <Link
            className={buttonClassName()}
            to="/plans"
          >
            View plans
          </Link>
        }
        description="Choose a plan when you are ready to apply for internet service."
        title="No application yet"
      />
    )
  }

  return (
    <section className="w-full max-w-4xl">
      <CustomerPageHeader
        description="Track your application review and see what happens next."
        eyebrow="Service application"
        title="Application status"
      />

      <div className="mt-8 rounded-[18px] border border-slate-900/8 bg-white p-5 shadow-[0_18px_50px_rgba(18,25,38,0.06)] sm:p-7">
        <CustomerServiceProgress current={application.status === 'approved' ? 'installation' : 'application'} />
      </div>

      <div className="mt-6 overflow-hidden rounded-[18px] border border-slate-900/8 bg-white shadow-[0_18px_50px_rgba(18,25,38,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-900/8 p-6 sm:p-7">
          <div>
            <p className="text-xs font-semibold tracking-[0.1em] text-slate-500 uppercase">Selected plan</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{application.plan?.name ?? 'Plan unavailable'}</h2>
          </div>
          <StatusBadge status={application.status} />
        </div>
        <dl className="p-6 sm:p-7">
          <dt className="text-xs text-slate-500">Submitted</dt>
          <dd className="mt-1 font-medium text-slate-900">{dateFormatter.format(new Date(application.submitted_at))}</dd>
        </dl>
        {application.status === 'rejected' && application.rejection_reason ? (
          <div className="border-t border-red-200 bg-red-50 p-6 sm:p-7">
            <p className="text-sm font-semibold text-red-900">
              Rejection reason
            </p>
            <p className="mt-2 text-sm leading-6 text-red-800">{application.rejection_reason}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
