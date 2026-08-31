import { type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

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
    <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
        Service availability
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">
        Check your address
      </h1>
      <p className="mt-3 text-slate-400">
        Enter your installation address to check whether service is currently
        available in your area.
      </p>

      <form className="mt-8" noValidate onSubmit={handleSubmit}>
        <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="address">
          Installation address
        </label>
        <textarea
          aria-describedby={fieldError ? 'address-error' : undefined}
          aria-invalid={fieldError ? true : undefined}
          className="min-h-28 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          id="address"
          name="address"
          onChange={(event) => updateAddress(event.target.value)}
          placeholder="House number, street, city"
          value={address}
        />
        {fieldError ? (
          <p className="mt-1.5 text-sm text-red-300" id="address-error" role="alert">
            {fieldError}
          </p>
        ) : null}

        <button
          className="mt-5 w-full rounded-lg bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? 'Checking availability...' : 'Check availability'}
        </button>
      </form>

      {result === 'available' ? (
        <div className="mt-6 rounded-xl border border-emerald-800 bg-emerald-950/50 p-5" role="status">
          <p className="font-semibold text-emerald-300">
            Service is available at this address.
          </p>
          <Link
            className="mt-4 inline-block rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-emerald-950 hover:bg-emerald-300"
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
        <p className="mt-6 rounded-xl border border-amber-800 bg-amber-950/50 p-5 text-amber-200" role="status">
          Service is not currently available at this address.
        </p>
      ) : null}

      {requestError ? (
        <p className="mt-6 rounded-xl border border-red-900 bg-red-950/50 p-5 text-red-200" role="alert">
          {requestError}
        </p>
      ) : null}
    </section>
  )
}
