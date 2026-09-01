import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ZodError } from 'zod'
import { getLoginErrorMessage } from './login-error-message'
import { loginSchema, type LoginFormValues } from './login-schema'
import { loginWithPassword } from './login'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

type FieldErrors = Partial<Record<keyof LoginFormValues, string>>

interface LoginFormProps {
  onSignedIn: (destination: string) => void
  redirectTo: string
}

const initialValues: LoginFormValues = {
  email: '',
  password: '',
}

function getFieldErrors(error: ZodError<LoginFormValues>): FieldErrors {
  const errors: FieldErrors = {}

  for (const issue of error.issues) {
    const field = issue.path[0]

    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof LoginFormValues] = issue.message
    }
  }

  return errors
}

export function LoginForm({ onSignedIn, redirectTo }: LoginFormProps) {
  const [values, setValues] = useState(initialValues)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof LoginFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmissionError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const parsed = loginSchema.safeParse(values)

    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error))
      return
    }

    setFieldErrors({})
    setSubmissionError(null)
    setIsSubmitting(true)

    try {
      await loginWithPassword(parsed.data.email, parsed.data.password)
      setValues(initialValues)
      onSignedIn(redirectTo)
    } catch (error) {
      setValues((current) => ({ ...current, password: '' }))
      setSubmissionError(getLoginErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="w-full max-w-md rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9">
      <Link
        className="mb-7 inline-flex min-h-11 items-center text-sm font-medium text-slate-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        to="/"
      >
        ← Back to home
      </Link>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
        ISP Platform
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Welcome back</h1>
      <p className="mt-2 text-slate-600">Sign in to manage your account.</p>

      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">
            Email address
          </label>
          <input
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            aria-invalid={fieldErrors.email ? true : undefined}
            autoComplete="email"
            className="min-h-12 w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-2.5 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            id="email"
            name="email"
            onChange={(event) => updateField('email', event.target.value)}
            type="email"
            value={values.email}
          />
          {fieldErrors.email ? (
            <p className="mt-1.5 text-sm text-red-700" id="email-error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            aria-invalid={fieldErrors.password ? true : undefined}
            autoComplete="current-password"
            className="min-h-12 w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-2.5 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            id="password"
            name="password"
            onChange={(event) => updateField('password', event.target.value)}
            type="password"
            value={values.password}
          />
          {fieldErrors.password ? (
            <p className="mt-1.5 text-sm text-red-700" id="password-error" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <Link className="block text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/forgot-password">
          Forgot password?
        </Link>

        {submissionError ? (
          <p className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {submissionError}
          </p>
        ) : null}

        <button
          className="public-primary-button flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign in</span>
          )}
        </button>

        <p className="text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link className="font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/signup">
            Create account
          </Link>
        </p>
      </form>
    </section>
  )
}
