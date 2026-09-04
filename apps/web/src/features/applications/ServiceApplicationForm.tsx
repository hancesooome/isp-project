import { type FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ZodError } from 'zod'

import { useAuth } from '../auth/auth-context'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  applicationSchema,
  type ApplicationFormValues,
} from './application-schema'

interface PlanOption {
  id: string
  name: string
}

type FieldErrors = Partial<Record<keyof ApplicationFormValues, string>>

const initialValues: ApplicationFormValues = {
  planId: '',
  phone: '',
  address: '',
  installationRegion: '',
  installationProvince: '',
  installationCityMunicipality: '',
  installationBarangay: '',
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
          installation_region: parsed.data.installationRegion,
          installation_province: parsed.data.installationProvince,
          installation_city_municipality:
            parsed.data.installationCityMunicipality,
          installation_barangay: parsed.data.installationBarangay,
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
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Application received
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">Thank you</h1>
        <p className="mt-4 text-slate-300" role="status">
          Your service application was submitted for review.
        </p>
        <Link
          className="mt-6 inline-block font-medium text-sky-400 hover:text-sky-300"
          to="/account/application"
        >
          View application status
        </Link>
      </section>
    )
  }

  return (
    <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
      <Link
        className="mb-4 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
        to="/"
      >
        ← Back to home
      </Link>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
        Service application
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">
        Apply for internet service
      </h1>
      <p className="mt-3 text-slate-400">
        Confirm your plan and provide the addresses needed for installation.
      </p>

      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="planId">
            Internet plan
          </label>
          <select
            aria-describedby={fieldErrors.planId ? 'planId-error' : undefined}
            aria-invalid={fieldErrors.planId ? true : undefined}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
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
            <p className="mt-1.5 text-sm text-slate-400" role="status">
              Loading plans...
            </p>
          ) : null}
          {plansError ? (
            <p className="mt-1.5 text-sm text-red-300" role="alert">
              {plansError}
            </p>
          ) : null}
          {fieldErrors.planId ? (
            <p className="mt-1.5 text-sm text-red-300" id="planId-error" role="alert">
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
        <fieldset className="space-y-5 border-t border-slate-800 pt-5">
          <legend className="text-sm font-semibold text-slate-200">
            Installation address
          </legend>
          <p className="text-sm text-slate-400">
            Enter the address where internet service will be installed.
          </p>
          <AddressField
            autoComplete="address-level1"
            error={fieldErrors.installationRegion}
            id="installationRegion"
            label="Region"
            onChange={(value) => updateField('installationRegion', value)}
            value={values.installationRegion}
          />
          <AddressField
            autoComplete="address-level1"
            error={fieldErrors.installationProvince}
            id="installationProvince"
            label="Province"
            onChange={(value) => updateField('installationProvince', value)}
            value={values.installationProvince}
          />
          <AddressField
            autoComplete="address-level2"
            error={fieldErrors.installationCityMunicipality}
            id="installationCityMunicipality"
            label="City or municipality"
            onChange={(value) =>
              updateField('installationCityMunicipality', value)
            }
            value={values.installationCityMunicipality}
          />
          <AddressField
            autoComplete="address-level3"
            error={fieldErrors.installationBarangay}
            id="installationBarangay"
            label="Barangay"
            onChange={(value) => updateField('installationBarangay', value)}
            value={values.installationBarangay}
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
          <p className="text-sm text-red-300" role="alert">
            {submissionError}
          </p>
        ) : null}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
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
      <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
        id={id}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-300" id={errorId} role="alert">
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
  | 'installationRegion'
  | 'installationProvince'
  | 'installationCityMunicipality'
  | 'installationBarangay'
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
      <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
        id={id}
        inputMode={inputMode}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-300" id={errorId} role="alert">
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
      <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor={id}>
        {label}
      </label>
      <textarea
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className="min-h-24 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
        id={id}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-300" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
