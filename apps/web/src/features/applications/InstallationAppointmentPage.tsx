import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { useAuth } from '../auth/auth-context'

type InstallationStatus =
  | 'pending_scheduling'
  | 'scheduled'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'reschedule_required'

interface CustomerInstallation {
  id: string
  status: InstallationStatus
  service_address: string
  scheduled_start_at: string | null
  scheduled_end_at: string | null
  schedule_timezone: 'Asia/Manila'
  created_at: string
  plan: { id: string; name: string } | null
}

const appointmentDateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'full',
  timeZone: 'Asia/Manila',
})

const appointmentTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Manila',
  timeZoneName: 'short',
})

const statusContent: Record<InstallationStatus, { label: string; title: string; instructions: string; tone: string }> = {
  pending_scheduling: {
    label: 'Pending scheduling',
    title: 'We are preparing your appointment',
    instructions: 'Our installation team will assign an appointment window. Keep your contact number available for scheduling updates.',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  scheduled: {
    label: 'Scheduled',
    title: 'Your installation is scheduled',
    instructions: 'Please ensure an adult is present and that the installation area and property access are available during the appointment window.',
    tone: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  assigned: {
    label: 'Team assigned',
    title: 'Your installation team is assigned',
    instructions: 'Please ensure an adult is present and that the installation area and property access are available during the appointment window.',
    tone: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  in_progress: {
    label: 'In progress',
    title: 'Installation is underway',
    instructions: 'Our field team is working on your connection. Please keep the service area accessible until the work is completed.',
    tone: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  completed: {
    label: 'Completed',
    title: 'Installation completed',
    instructions: 'Your installation work is complete. If you experience a service issue, contact support from your account.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  cancelled: {
    label: 'Cancelled',
    title: 'Installation was cancelled',
    instructions: 'Contact support if you need help or want to discuss the next available options for your service.',
    tone: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  reschedule_required: {
    label: 'Needs rescheduling',
    title: 'A new appointment is needed',
    instructions: 'Our team will arrange another appointment window. You can contact support if your availability has changed.',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  },
}

function isCustomerInstallation(value: unknown): value is CustomerInstallation {
  if (!value || typeof value !== 'object') return false
  const installation = value as Record<string, unknown>
  const plan = installation.plan
  return (
    typeof installation.id === 'string' &&
    typeof installation.status === 'string' &&
    installation.status in statusContent &&
    typeof installation.service_address === 'string' &&
    (installation.scheduled_start_at === null || typeof installation.scheduled_start_at === 'string') &&
    (installation.scheduled_end_at === null || typeof installation.scheduled_end_at === 'string') &&
    installation.schedule_timezone === 'Asia/Manila' &&
    typeof installation.created_at === 'string' &&
    (plan === null || (typeof plan === 'object' && typeof (plan as Record<string, unknown>).id === 'string' && typeof (plan as Record<string, unknown>).name === 'string'))
  )
}

export function InstallationAppointmentPage() {
  const { session } = useAuth()
  const [installation, setInstallation] = useState<CustomerInstallation | null>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function loadInstallation() {
      try {
        const response = await fetch('/api/installation', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('INSTALLATION_REQUEST_FAILED')
        const result: unknown = await response.json()
        if (!result || typeof result !== 'object' || !('installation' in result) ||
          (result.installation !== null && !isCustomerInstallation(result.installation))) {
          throw new Error('INVALID_INSTALLATION_RESPONSE')
        }
        setInstallation(result.installation)
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError('We could not load your installation appointment. Please try again later.')
      }
    }

    void loadInstallation()
    return () => controller.abort()
  }, [session])

  if (error) return <ErrorPanel message={error} title="Installation unavailable" />
  if (installation === undefined) return <PageSkeleton type="detail" />
  if (installation === null) return <EmptyState action={<Link className="inline-flex min-h-11 items-center rounded-[10px] bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" to="/account/application">View application status</Link>} description="An installation order will appear after your service application is approved." title="No installation appointment yet" />

  const content = statusContent[installation.status]
  const hasAppointment = installation.scheduled_start_at && installation.scheduled_end_at

  return (
    <section className="w-full max-w-4xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">My internet</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">Installation appointment</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">Follow the progress of your new service installation.</p>
      </header>

      <div className="mt-7 overflow-hidden rounded-[18px] border border-slate-900/10 bg-white shadow-[0_18px_50px_rgba(18,25,38,0.08)]">
        <div className="border-b border-slate-900/8 p-6 sm:p-8">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${content.tone}`}>{content.label}</span>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-2xl">{content.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{content.instructions}</p>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b border-slate-900/8 p-6 sm:p-8 md:border-r md:border-b-0">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Appointment window</p>
            {hasAppointment ? <>
              <p className="mt-3 text-lg font-semibold text-slate-950">{appointmentDateFormatter.format(new Date(installation.scheduled_start_at!))}</p>
              <p className="mt-1 text-base text-slate-700">{appointmentTimeFormatter.format(new Date(installation.scheduled_start_at!))} – {appointmentTimeFormatter.format(new Date(installation.scheduled_end_at!))}</p>
            </> : <><p className="mt-3 font-semibold text-slate-950">To be confirmed</p><p className="mt-1 text-sm text-slate-500">Your appointment window has not been assigned yet.</p></>}
          </div>
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Selected plan</p>
            <p className="mt-3 text-lg font-semibold text-slate-950">{installation.plan?.name ?? 'Plan unavailable'}</p>
            <p className="mt-1 text-sm text-slate-500">Plan selected for this installation</p>
          </div>
        </div>

        <div className="border-t border-slate-900/8 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Service address</p>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-800">{installation.service_address}</p>
        </div>
      </div>

      <p className="mt-5 text-sm text-slate-500">Need help with this appointment? <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/account/support">Contact support</Link>.</p>
    </section>
  )
}
