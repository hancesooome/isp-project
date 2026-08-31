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
    <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
      <Link
        className="mb-4 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
        to="/"
      >
        ← Back to home
      </Link>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
        ISP Platform
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">Welcome back</h1>
      <p className="mt-2 text-slate-400">Sign in to manage your account.</p>

      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="email">
            Email address
          </label>
          <input
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            aria-invalid={fieldErrors.email ? true : undefined}
            autoComplete="email"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            id="email"
            name="email"
            onChange={(event) => updateField('email', event.target.value)}
            type="email"
            value={values.email}
          />
          {fieldErrors.email ? (
            <p className="mt-1.5 text-sm text-red-300" id="email-error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="password">
            Password
          </label>
          <input
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            aria-invalid={fieldErrors.password ? true : undefined}
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            id="password"
            name="password"
            onChange={(event) => updateField('password', event.target.value)}
            type="password"
            value={values.password}
          />
          {fieldErrors.password ? (
            <p className="mt-1.5 text-sm text-red-300" id="password-error" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <Link className="block text-sm text-sky-400 hover:text-sky-300" to="/forgot-password">
          Forgot password?
        </Link>

        {submissionError ? (
          <p className="text-sm text-red-300" role="alert">
            {submissionError}
          </p>
        ) : null}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
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

        <p className="text-center text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <Link className="font-medium text-sky-400 hover:text-sky-300" to="/signup">
            Create account
          </Link>
        </p>
      </form>
    </section>
  )
}
