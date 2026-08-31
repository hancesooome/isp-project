import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'

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
    return (
      <p
        className="w-full max-w-xl rounded-xl border border-red-900 bg-red-950/50 p-5 text-center text-red-200"
        role="alert"
      >
        {error}
      </p>
    )
  }

  if (application === undefined) {
    return <p role="status">Loading your application...</p>
  }

  if (application === null) {
    return (
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-xl">
        <h1 className="text-3xl font-bold text-white">No application yet</h1>
        <p className="mt-3 text-slate-400">
          Choose a plan when you are ready to apply for internet service.
        </p>
        <Link
          className="mt-6 inline-block rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400"
          to="/plans"
        >
          View plans
        </Link>
      </section>
    )
  }

  const statusStyles = {
    pending: 'border-amber-700 bg-amber-950/50 text-amber-200',
    approved: 'border-emerald-700 bg-emerald-950/50 text-emerald-200',
    rejected: 'border-red-800 bg-red-950/50 text-red-200',
  }

  return (
    <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
        Service application
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">
        Application status
      </h1>

      <div className="mt-8 space-y-5">
        <div>
          <p className="text-sm text-slate-400">Status</p>
          <p
            className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm font-semibold capitalize ${statusStyles[application.status]}`}
          >
            {application.status}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Selected plan</p>
          <p className="mt-1 font-semibold text-white">
            {application.plan?.name ?? 'Plan unavailable'}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Submitted</p>
          <p className="mt-1 text-white">
            {dateFormatter.format(new Date(application.submitted_at))}
          </p>
        </div>
        {application.status === 'rejected' && application.rejection_reason ? (
          <div className="rounded-xl border border-red-900 bg-red-950/40 p-4">
            <p className="text-sm font-semibold text-red-200">
              Rejection reason
            </p>
            <p className="mt-2 text-red-100">{application.rejection_reason}</p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
