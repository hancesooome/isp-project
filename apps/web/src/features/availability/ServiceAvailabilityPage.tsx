import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

const availabilitySchema = z.object({
  address: z
    .string()
    .trim()
    .min(5, 'Enter a complete service address')
    .max(250, 'Address must be 250 characters or fewer'),
})

type AvailabilityResult = 'available' | 'unavailable' | null

export function ServiceAvailabilityPage() {
  const [searchParams] = useSearchParams()
  const selectedPlanId = searchParams.get('plan')
  const [address, setAddress] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [result, setResult] = useState<AvailabilityResult>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = availabilitySchema.safeParse({ address })

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid address')
      setResult(null)
      return
    }

    setFieldError(null)
    setRequestError(null)
    setResult(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/service-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: parsed.data.address }),
      })

      if (!response.ok) {
        throw new Error('AVAILABILITY_REQUEST_FAILED')
      }

      const data: unknown = await response.json()

      if (
        typeof data !== 'object' ||
        data === null ||
        !('available' in data) ||
        typeof data.available !== 'boolean'
      ) {
        throw new Error('INVALID_AVAILABILITY_RESPONSE')
      }

      setResult(data.available ? 'available' : 'unavailable')
    } catch {
      setRequestError(
        'We could not check this address right now. Please try again later.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  function updateAddress(value: string) {
    setAddress(value)
    setFieldError(null)
    setRequestError(null)
    setResult(null)
  }

  return (
    <section className="w-full max-w-xl rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9">
      <Link
        className="mb-7 inline-flex min-h-11 items-center text-sm font-medium text-slate-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        to="/"
      >
        &larr; Back to home
      </Link>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
        Service availability
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
        Check your address
      </h1>
      <p className="mt-3 leading-7 text-slate-600">
        Enter your installation address to check whether service is currently
        available in your area.
      </p>

      <form className="mt-8" noValidate onSubmit={handleSubmit}>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="address">
          Installation address
        </label>
        <textarea
          aria-describedby={fieldError ? 'address-error' : undefined}
          aria-invalid={fieldError ? true : undefined}
          className="min-h-28 w-full resize-y rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-3 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          id="address"
          name="address"
          onChange={(event) => updateAddress(event.target.value)}
          placeholder="e.g. 123 Main Street, Barangay Central, Quezon City"
          value={address}
        />
        {fieldError ? (
          <p className="mt-1.5 text-sm text-red-700" id="address-error" role="alert">
            {fieldError}
          </p>
        ) : null}

        <button
          className="public-primary-button mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Checking availability...</span>
            </>
          ) : (
            <span>Check availability</span>
          )}
        </button>
      </form>

      {result === 'available' ? (
        <div className="mt-6 rounded-[12px] border border-emerald-200 bg-emerald-50 p-5" role="status">
          <p className="font-semibold text-emerald-800">
            Service is available at this address.
          </p>
          <Link
            className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            to={
              selectedPlanId
                ? `/apply?plan=${encodeURIComponent(selectedPlanId)}`
                : '/plans'
            }
          >
            {selectedPlanId ? 'Continue application' : 'View available plans'}
          </Link>
        </div>
      ) : null}

      {result === 'unavailable' ? (
        <p className="mt-6 rounded-[12px] border border-amber-200 bg-amber-50 p-5 text-amber-800" role="status">
          Service is not currently available at this address.
        </p>
      ) : null}

      {requestError ? (
        <div className="mt-6">
          <div className="rounded-[12px] border border-red-200 bg-red-50 p-5" role="alert">
            <p className="font-semibold text-red-900">Check failed</p>
            <p className="mt-2 text-sm text-red-700">{requestError}</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
