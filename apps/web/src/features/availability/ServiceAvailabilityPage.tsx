import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  PhilippineLocationFields,
  type PhilippineLocationValue,
} from '../applications/PhilippineLocationFields'
import { InstallationLocationMap } from '../applications/InstallationLocationMap'
import { saveAvailabilityContext } from './availability-context'

const availabilitySchema = z.object({
  regionCode: z.string().regex(/^[0-9]{10}$/, 'Select a region'),
  provinceCode: z.string().refine(
    (value) => value === '' || /^[0-9]{10}$/.test(value),
    'Select a province',
  ),
  cityMunicipalityCode: z.string().regex(/^[0-9]{10}$/, 'Select a city or municipality'),
  barangayCode: z.string().regex(/^[0-9]{10}$/, 'Select a barangay'),
  streetAddress: z.string().trim().min(3, 'Enter the street address').max(250),
  postalCode: z.string().trim().regex(/^[0-9]{4}$/, 'Enter a valid 4-digit postal code'),
  landmark: z.string().trim().max(250),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
}).superRefine((values, context) => {
  if (values.latitude === null || values.longitude === null) {
    context.addIssue({ code: 'custom', message: 'Confirm the installation point on the map', path: ['latitude'] })
  }
})

type AvailabilityValues = z.infer<typeof availabilitySchema>
interface AvailablePlan {
  id: string
  name: string
  description: string | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
}
type AvailabilityResult = { available: boolean; plans: AvailablePlan[] } | null
type FieldErrors = Partial<Record<keyof AvailabilityValues, string>>

const initialValues: AvailabilityValues = {
  regionCode: '', provinceCode: '', cityMunicipalityCode: '', barangayCode: '',
  streetAddress: '', postalCode: '', landmark: '', latitude: null, longitude: null,
}

const priceFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

function isAvailablePlan(value: unknown): value is AvailablePlan {
  if (typeof value !== 'object' || value === null) return false
  const plan = value as Record<string, unknown>
  return typeof plan.id === 'string' && typeof plan.name === 'string' &&
    (typeof plan.description === 'string' || plan.description === null) &&
    typeof plan.price_cents === 'number' &&
    (plan.billing_interval === 'monthly' || plan.billing_interval === 'yearly')
}

export function ServiceAvailabilityPage() {
  const [searchParams] = useSearchParams()
  const selectedPlanId = searchParams.get('plan')
  const [values, setValues] = useState(initialValues)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [result, setResult] = useState<AvailabilityResult>(null)
  const [isLoading, setIsLoading] = useState(false)

  function updateField(field: 'streetAddress' | 'postalCode' | 'landmark', value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
      ...(field === 'streetAddress' ? { latitude: null, longitude: null } : {}),
    }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setRequestError(null)
    setResult(null)
  }

  function updateLocation(location: PhilippineLocationValue) {
    setValues((current) => ({ ...current, ...location, latitude: null, longitude: null }))
    setFieldErrors({})
    setRequestError(null)
    setResult(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = availabilitySchema.safeParse(values)

    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !(field in errors)) {
          errors[field as keyof AvailabilityValues] = issue.message
        }
      }
      setFieldErrors(errors)
      setResult(null)
      return
    }

    setFieldErrors({})
    setRequestError(null)
    setResult(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/service-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region_code: parsed.data.regionCode,
          province_code: parsed.data.provinceCode || null,
          city_municipality_code: parsed.data.cityMunicipalityCode,
          barangay_code: parsed.data.barangayCode,
          street_address: parsed.data.streetAddress,
          postal_code: parsed.data.postalCode,
          landmark: parsed.data.landmark,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
        }),
      })

      if (!response.ok) throw new Error('AVAILABILITY_REQUEST_FAILED')
      const data: unknown = await response.json()
      if (typeof data !== 'object' || data === null || !('available' in data) || typeof data.available !== 'boolean' ||
        !('plans' in data) || !Array.isArray(data.plans) || !data.plans.every(isAvailablePlan)) {
        throw new Error('INVALID_AVAILABILITY_RESPONSE')
      }
      setResult({ available: data.available, plans: data.plans })
    } catch {
      setRequestError('We could not check this address right now. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Service availability</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Check your address</h1>
      <p className="mt-3 leading-7 text-slate-600">Select your official Philippine location so spelling mistakes do not affect the check.</p>

      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
        <PhilippineLocationFields errors={fieldErrors} onChange={updateLocation} value={values} />
        <AddressInput error={fieldErrors.streetAddress} id="streetAddress" label="Street, house, building, or unit" onChange={updateField} value={values.streetAddress} />
        <AddressInput error={fieldErrors.postalCode} id="postalCode" inputMode="numeric" label="Postal code" onChange={updateField} value={values.postalCode} />
        <AddressInput error={fieldErrors.landmark} id="landmark" label="Landmark (optional)" onChange={updateField} value={values.landmark} />
        <InstallationLocationMap
          error={fieldErrors.latitude}
          onChange={(coordinates) => {
            setValues((current) => ({ ...current, ...coordinates }))
            setFieldErrors((current) => ({ ...current, latitude: undefined }))
            setRequestError(null)
            setResult(null)
          }}
          value={values.latitude !== null && values.longitude !== null ? { latitude: values.latitude, longitude: values.longitude } : null}
        />
        <button className="public-primary-button flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoading} type="submit">
          {isLoading ? <><LoadingSpinner size="sm" /><span>Checking availability...</span></> : <span>Check availability</span>}
        </button>
      </form>

      {result?.available ? (
        <div className="mt-6 rounded-[12px] border border-emerald-200 bg-emerald-50 p-5" role="status">
          <p className="font-semibold text-emerald-800">Service is available at the selected map location.</p>
          {result.plans.length === 0 ? <p className="mt-2 text-sm text-emerald-800">No plans are assigned to this area yet.</p> : (
            <div className="mt-4 grid gap-3">
              {result.plans.map((plan) => {
                const wasSelected = plan.id === selectedPlanId
                return <article className={`rounded-[10px] border bg-white p-4 ${wasSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-emerald-200'}`} key={plan.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">{plan.name}</h2><p className="mt-1 text-sm text-slate-600">{plan.description ?? 'Reliable internet service for your home.'}</p></div><p className="font-semibold text-slate-950">{priceFormatter.format(plan.price_cents / 100)}<span className="text-xs font-normal text-slate-500">/{plan.billing_interval === 'monthly' ? 'month' : 'year'}</span></p></div>
                  <Link className="mt-3 inline-flex min-h-11 items-center rounded-[9px] bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800" onClick={() => saveAvailabilityContext({ ...values, latitude: values.latitude!, longitude: values.longitude!, eligiblePlanIds: result.plans.map(({ id }) => id) })} to={`/apply?plan=${encodeURIComponent(plan.id)}`}>{wasSelected ? 'Continue with this plan' : 'Choose this plan'}</Link>
                </article>
              })}
            </div>
          )}
        </div>
      ) : null}
      {result && !result.available ? <p className="mt-6 rounded-[12px] border border-amber-200 bg-amber-50 p-5 text-amber-800" role="status">Service is not currently available at the selected map location.</p> : null}
      {requestError ? <div className="mt-6 rounded-[12px] border border-red-200 bg-red-50 p-5" role="alert"><p className="font-semibold text-red-900">Check failed</p><p className="mt-2 text-sm text-red-700">{requestError}</p></div> : null}
    </section>
  )
}

interface AddressInputProps {
  error?: string
  id: 'streetAddress' | 'postalCode' | 'landmark'
  inputMode?: 'numeric'
  label: string
  onChange: (field: AddressInputProps['id'], value: string) => void
  value: string
}

function AddressInput({ error, id, inputMode, label, onChange, value }: AddressInputProps) {
  const errorId = `${id}-error`
  return <div><label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>{label}</label><input aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined} className="w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-3 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" id={id} inputMode={inputMode} name={id} onChange={(event) => onChange(id, event.target.value)} value={value} />{error ? <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">{error}</p> : null}</div>
}
