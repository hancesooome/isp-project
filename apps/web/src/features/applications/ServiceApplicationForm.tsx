import { type FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ZodError } from 'zod'

import { useAuth } from '../auth/auth-context'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  applicationSchema,
  type ApplicationFormValues,
} from './application-schema'
import { PhilippineLocationFields } from './PhilippineLocationFields'

interface PlanOption {
  id: string
  name: string
}

type FieldErrors = Partial<Record<keyof ApplicationFormValues, string>>

const initialValues: ApplicationFormValues = {
  planId: '',
  phone: '',
  address: '',
  installationRegionCode: '',
  installationProvinceCode: '',
  installationCityMunicipalityCode: '',
  installationBarangayCode: '',
  installationStreetAddress: '',
  installationPostalCode: '',
  installationLandmark: '',
}

function getFieldErrors(
  error: ZodError<ApplicationFormValues>,
): FieldErrors {
  const errors: FieldErrors = {}

  for (const issue of error.issues) {
    const field = issue.path[0]

    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof ApplicationFormValues] = issue.message
    }
  }

  return errors
}

function isPlanOption(value: unknown): value is PlanOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const plan = value as Record<string, unknown>
  return typeof plan.id === 'string' && typeof plan.name === 'string'
}

export function ServiceApplicationForm() {
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const [values, setValues] = useState(() => ({
    ...initialValues,
    planId: searchParams.get('plan') ?? '',
  }))
  const [plans, setPlans] = useState<PlanOption[] | null>(null)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadPlans() {
      try {
        const response = await fetch('/api/plans', {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('PLANS_REQUEST_FAILED')
        }

        const result: unknown = await response.json()

        if (
          typeof result !== 'object' ||
          result === null ||
          !('plans' in result) ||
          !Array.isArray(result.plans) ||
          !result.plans.every(isPlanOption)
        ) {
          throw new Error('INVALID_PLANS_RESPONSE')
        }

        setPlans(result.plans)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        setPlansError('We could not load the available plans.')
      }
    }

    void loadPlans()
    return () => controller.abort()
  }, [])

  function updateField(field: keyof ApplicationFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmissionError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const parsed = applicationSchema.safeParse(values)

    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error))
      return
    }

    if (!session) {
      setSubmissionError('Your session has expired. Please sign in again.')
      return
    }

    setFieldErrors({})
    setSubmissionError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: parsed.data.planId,
          phone: parsed.data.phone,
          address: parsed.data.address,
          installation_region_code: parsed.data.installationRegionCode,
          installation_province_code:
            parsed.data.installationProvinceCode || null,
          installation_city_municipality_code:
            parsed.data.installationCityMunicipalityCode,
          installation_barangay_code: parsed.data.installationBarangayCode,
          installation_street_address: parsed.data.installationStreetAddress,
          installation_postal_code: parsed.data.installationPostalCode,
          installation_landmark: parsed.data.installationLandmark,
        }),
      })

      if (!response.ok) {
        throw new Error('APPLICATION_SUBMISSION_FAILED')
      }

      setIsSubmitted(true)
    } catch {
      setSubmissionError(
        'We could not submit your application. Please try again later.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <section className="w-full max-w-xl rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Application received
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Thank you</h1>
        <p className="mt-4 text-slate-600" role="status">
          Your service application was submitted for review.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center font-semibold text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          to="/account/application"
        >
          View application status
        </Link>
      </section>
    )
  }

  return (
    <section className="w-full max-w-2xl rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9">
      <Link
        className="mb-7 inline-flex min-h-11 items-center text-sm font-medium text-slate-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        to="/"
      >
        ← Back to home
      </Link>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
        Service application
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
        Apply for internet service
      </h1>
      <p className="mt-3 leading-7 text-slate-600">
        Confirm your plan and provide the addresses needed for installation.
      </p>

      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="planId">
            Internet plan
          </label>
          <select
            aria-describedby={fieldErrors.planId ? 'planId-error' : undefined}
            aria-invalid={fieldErrors.planId ? true : undefined}
            className="w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-3 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            disabled={plans === null || plansError !== null}
            id="planId"
            name="planId"
            onChange={(event) => updateField('planId', event.target.value)}
            value={values.planId}
          >
            <option value="">Select a plan</option>
            {plans?.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          {plans === null && !plansError ? (
            <p className="mt-1.5 text-sm text-slate-500" role="status">
              Loading plans...
            </p>
          ) : null}
          {plansError ? (
            <p className="mt-1.5 text-sm text-red-700" role="alert">
              {plansError}
            </p>
          ) : null}
          {fieldErrors.planId ? (
            <p className="mt-1.5 text-sm text-red-700" id="planId-error" role="alert">
              {fieldErrors.planId}
            </p>
          ) : null}
        </div>

        <TextField
          autoComplete="tel"
          error={fieldErrors.phone}
          id="phone"
          label="Phone number"
          onChange={(value) => updateField('phone', value)}
          type="tel"
          value={values.phone}
        />
        <TextAreaField
          autoComplete="street-address"
          error={fieldErrors.address}
          id="address"
          label="Current address"
          onChange={(value) => updateField('address', value)}
          value={values.address}
        />
        <fieldset className="space-y-5 border-t border-slate-900/10 pt-6">
          <legend className="text-sm font-semibold text-slate-800">
            Installation address
          </legend>
          <p className="text-sm text-slate-600">
            Enter the address where internet service will be installed.
          </p>
          <PhilippineLocationFields
            errors={{
              regionCode: fieldErrors.installationRegionCode,
              provinceCode: fieldErrors.installationProvinceCode,
              cityMunicipalityCode:
                fieldErrors.installationCityMunicipalityCode,
              barangayCode: fieldErrors.installationBarangayCode,
            }}
            onChange={(location) => {
              setValues((current) => ({
                ...current,
                installationRegionCode: location.regionCode,
                installationProvinceCode: location.provinceCode,
                installationCityMunicipalityCode:
                  location.cityMunicipalityCode,
                installationBarangayCode: location.barangayCode,
              }))
              setFieldErrors((current) => ({
                ...current,
                installationRegionCode: undefined,
                installationProvinceCode: undefined,
                installationCityMunicipalityCode: undefined,
                installationBarangayCode: undefined,
              }))
              setSubmissionError(null)
            }}
            value={{
              regionCode: values.installationRegionCode,
              provinceCode: values.installationProvinceCode,
              cityMunicipalityCode: values.installationCityMunicipalityCode,
              barangayCode: values.installationBarangayCode,
            }}
          />
          <TextAreaField
            autoComplete="street-address"
            error={fieldErrors.installationStreetAddress}
            id="installationStreetAddress"
            label="Street, house, building, or unit"
            onChange={(value) =>
              updateField('installationStreetAddress', value)
            }
            value={values.installationStreetAddress}
          />
          <AddressField
            autoComplete="postal-code"
            error={fieldErrors.installationPostalCode}
            id="installationPostalCode"
            inputMode="numeric"
            label="Postal code"
            onChange={(value) => updateField('installationPostalCode', value)}
            value={values.installationPostalCode}
          />
          <AddressField
            autoComplete="off"
            error={fieldErrors.installationLandmark}
            id="installationLandmark"
            label="Landmark (optional)"
            onChange={(value) => updateField('installationLandmark', value)}
            value={values.installationLandmark}
          />
        </fieldset>

        {submissionError ? (
          <p className="text-sm text-red-700" role="alert">
            {submissionError}
          </p>
        ) : null}

        <button
          className="public-primary-button flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || plans === null || plansError !== null}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Submitting application...</span>
            </>
          ) : (
            <span>Submit application</span>
          )}
        </button>
      </form>
    </section>
  )
}

interface TextFieldProps {
  autoComplete: string
  error?: string
  id: 'phone'
  label: string
  onChange: (value: string) => void
  type: 'tel'
  value: string
}

function TextField({
  autoComplete,
  error,
  id,
  label,
  onChange,
  type,
  value,
}: TextFieldProps) {
  const errorId = `${id}-error`

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className="w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-3 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        id={id}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface TextAreaFieldProps {
  autoComplete: string
  error?: string
  id: 'address' | 'installationStreetAddress'
  label: string
  onChange: (value: string) => void
  value: string
}

type AddressFieldId =
  | 'installationPostalCode'
  | 'installationLandmark'

interface AddressFieldProps {
  autoComplete: string
  error?: string
  id: AddressFieldId
  inputMode?: 'numeric'
  label: string
  onChange: (value: string) => void
  value: string
}

function AddressField({
  autoComplete,
  error,
  id,
  inputMode,
  label,
  onChange,
  value,
}: AddressFieldProps) {
  const errorId = `${id}-error`

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className="w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-3 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        id={id}
        inputMode={inputMode}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function TextAreaField({
  autoComplete,
  error,
  id,
  label,
  onChange,
  value,
}: TextAreaFieldProps) {
  const errorId = `${id}-error`

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <textarea
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className="min-h-24 w-full resize-y rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-3 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        id={id}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
