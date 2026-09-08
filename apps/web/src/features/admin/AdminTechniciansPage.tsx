import { type FormEvent, useEffect, useState } from 'react'

import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorPanel } from '../../components/ui/ErrorPanel'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { PageSkeleton } from '../../components/ui/PageSkeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useAuth } from '../auth/auth-context'

interface Technician {
  profile_id: string
  technician_code: string
  is_active: boolean
  availability_status: 'available' | 'unavailable' | 'on_leave'
  created_at: string
  email: string | null
  email_confirmed_at: string | null
  profile: { full_name: string | null } | null
  coverage_area: { id: string; name: string } | null
}

interface CoverageArea {
  id: string
  name: string
  is_active: boolean
}

const initialForm = {
  email: '',
  fullName: '',
  technicianCode: '',
  coverageAreaId: '',
}

export function AdminTechniciansPage() {
  const { session } = useAuth()
  const [technicians, setTechnicians] = useState<Technician[] | null>(null)
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([])
  const [form, setForm] = useState(initialForm)
  const [showForm, setShowForm] = useState(false)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    const headers = { Authorization: `Bearer ${session.access_token}` }

    async function load() {
      try {
        const [technicianResponse, coverageResponse] = await Promise.all([
          fetch('/api/admin/technicians', { headers, signal: controller.signal }),
          fetch('/api/admin/coverage', { headers, signal: controller.signal }),
        ])
        if (!technicianResponse.ok || !coverageResponse.ok) throw new Error('LOAD_FAILED')

        const technicianResult: unknown = await technicianResponse.json()
        const coverageResult: unknown = await coverageResponse.json()
        if (
          !isObject(technicianResult) ||
          !Array.isArray(technicianResult.technicians) ||
          !technicianResult.technicians.every(isTechnician) ||
          !isObject(coverageResult) ||
          !Array.isArray(coverageResult.coverage_areas)
        ) throw new Error('INVALID_RESPONSE')

        setTechnicians(technicianResult.technicians)
        setCoverageAreas(
          coverageResult.coverage_areas.filter(isCoverageArea).filter((area) => area.is_active),
        )
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setLoadingError('We could not load technician accounts. Please try again later.')
      }
    }

    void load()
    return () => controller.abort()
  }, [session])

  async function inviteTechnician(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || submitting) return

    setSubmitting(true)
    setFormError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/admin/technicians', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email,
          full_name: form.fullName,
          technician_code: form.technicianCode,
          primary_coverage_area_id: form.coverageAreaId || null,
        }),
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        throw new Error(isObject(result) && typeof result.error === 'string' ? result.error : 'Unable to invite technician')
      }

      setForm(initialForm)
      setShowForm(false)
      setSuccess(`Invitation sent to ${form.email}.`)
      const refreshed = await fetch('/api/admin/technicians', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const refreshedResult: unknown = await refreshed.json()
      if (refreshed.ok && isObject(refreshedResult) && Array.isArray(refreshedResult.technicians) && refreshedResult.technicians.every(isTechnician)) {
        setTechnicians(refreshedResult.technicians)
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to invite technician')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="w-full">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-blue-400 uppercase">Admin portal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">Technicians</h1>
          <p className="mt-2 text-sm text-slate-400">Invite technician accounts and review operational availability.</p>
        </div>
        <button className="min-h-11 rounded-[9px] bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => { setShowForm((current) => !current); setFormError(null) }} type="button">
          {showForm ? 'Close form' : 'Invite technician'}
        </button>
      </header>

      {showForm ? (
        <form className="mt-6 border-y border-white/8 py-6" onSubmit={(event) => void inviteTechnician(event)}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Full name"><input autoComplete="name" className={inputClass} maxLength={120} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required value={form.fullName} /></Field>
            <Field label="Email address"><input autoComplete="email" className={inputClass} onChange={(event) => setForm({ ...form, email: event.target.value })} required type="email" value={form.email} /></Field>
            <Field help="3–32 uppercase letters, numbers, or hyphens." label="Technician code"><input className={inputClass} maxLength={32} onChange={(event) => setForm({ ...form, technicianCode: event.target.value.toUpperCase() })} pattern="[A-Z0-9][A-Z0-9-]{2,31}" placeholder="TECH-001" required value={form.technicianCode} /></Field>
            <Field label="Primary coverage area"><select className={inputClass} onChange={(event) => setForm({ ...form, coverageAreaId: event.target.value })} value={form.coverageAreaId}><option value="">No primary area</option>{coverageAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></Field>
          </div>
          {formError ? <p className="mt-4 text-sm text-red-300" role="alert">{formError}</p> : null}
          <div className="mt-5 flex gap-3">
            <button className="flex min-h-11 items-center gap-2 rounded-[9px] bg-blue-500 px-5 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-60" disabled={submitting} type="submit">{submitting ? <><LoadingSpinner />Sending invitation…</> : 'Send invitation'}</button>
            <button className="min-h-11 rounded-[9px] border border-white/10 px-4 text-sm text-slate-300" disabled={submitting} onClick={() => setShowForm(false)} type="button">Cancel</button>
          </div>
        </form>
      ) : null}

      {success ? <p className="mt-5 rounded-[10px] border border-emerald-800/60 bg-emerald-950/30 p-4 text-sm text-emerald-200" role="status">{success}</p> : null}
      <div className="mt-7">
        {loadingError ? <ErrorPanel message={loadingError} title="Technicians unavailable" /> : technicians === null ? <PageSkeleton count={5} type="list" /> : technicians.length === 0 ? <EmptyState description="Invite a technician to make them available for installation assignments." title="No technicians" /> : (
          <div className="overflow-hidden rounded-[14px] border border-white/8 bg-[#11161f]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-white/8 bg-white/3 text-xs tracking-[0.08em] text-slate-500 uppercase"><tr><th className="px-5 py-4">Technician</th><th className="px-5 py-4">Code</th><th className="px-5 py-4">Coverage</th><th className="px-5 py-4">Availability</th><th className="px-5 py-4">Account</th></tr></thead>
                <tbody className="divide-y divide-white/8">{technicians.map((technician) => <tr key={technician.profile_id}><td className="px-5 py-4"><p className="font-medium text-white">{technician.profile?.full_name ?? 'Name unavailable'}</p><p className="mt-1 text-xs text-slate-500">{technician.email ?? 'Email unavailable'}</p></td><td className="px-5 py-4 font-mono text-xs text-slate-300">{technician.technician_code}</td><td className="px-5 py-4 text-slate-300">{technician.coverage_area?.name ?? 'Not assigned'}</td><td className="px-5 py-4"><StatusBadge status={technician.is_active ? technician.availability_status : 'inactive'} /></td><td className="px-5 py-4 text-slate-300">{technician.email_confirmed_at ? 'Ready' : 'Invitation pending'}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

const inputClass = 'min-h-11 w-full rounded-[9px] border border-white/10 bg-[#161c26] px-3 text-sm text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20'

function Field({ children, help, label }: { children: React.ReactNode; help?: string; label: string }) {
  return <label className="block text-sm font-medium text-slate-300"><span className="mb-2 block">{label}</span>{children}{help ? <span className="mt-1.5 block text-xs font-normal text-slate-500">{help}</span> : null}</label>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isTechnician(value: unknown): value is Technician {
  if (!isObject(value)) return false
  return typeof value.profile_id === 'string' && typeof value.technician_code === 'string' && typeof value.is_active === 'boolean' && (value.availability_status === 'available' || value.availability_status === 'unavailable' || value.availability_status === 'on_leave') && typeof value.created_at === 'string' && isNullableString(value.email) && isNullableString(value.email_confirmed_at) && (value.profile === null || (isObject(value.profile) && isNullableString(value.profile.full_name))) && (value.coverage_area === null || (isObject(value.coverage_area) && typeof value.coverage_area.id === 'string' && typeof value.coverage_area.name === 'string'))
}

function isCoverageArea(value: unknown): value is CoverageArea {
  return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.is_active === 'boolean'
}
