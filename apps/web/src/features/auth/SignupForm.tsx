import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ZodError } from 'zod'
import {
  signupSchema,
  type SignupFormValues,
} from './signup-schema'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { signUpCustomer } from './signup'

type FieldErrors = Partial<Record<keyof SignupFormValues, string>>

const initialValues: SignupFormValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function getFieldErrors(error: ZodError<SignupFormValues>): FieldErrors {
  const errors: FieldErrors = {}

  for (const issue of error.issues) {
    const field = issue.path[0]

    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof SignupFormValues] = issue.message
    }
  }

  return errors
}

export function SignupForm() {
  const [values, setValues] = useState(initialValues)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  function updateField(field: keyof SignupFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setSubmissionError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const parsed = signupSchema.safeParse(values)

    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error))
      return
    }

    setFieldErrors({})
    setSubmissionError(null)
    setIsSubmitting(true)

    try {
      const result = await signUpCustomer({
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        password: parsed.data.password,
        redirectTo: window.location.origin,
      })

      setSuccessMessage(
        result.requiresEmailConfirmation
          ? 'Check your email to verify your account before signing in.'
          : 'Your account has been created successfully.',
      )
    } catch {
      setSubmissionError(
        'We could not create your account. Please check your details and try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successMessage) {
    return (
      <section className="w-full max-w-md rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9">
        <Link
          className="mb-7 inline-flex min-h-11 items-center text-sm font-medium text-slate-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          to="/"
        >
          ← Back to home
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Account created
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Check your email</h1>
        <p className="mt-4 leading-7 text-slate-600" role="status">
          {successMessage}
        </p>
        <Link
          className="public-primary-button mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] px-4 py-3 font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          to="/login"
        >
          Continue to sign in
        </Link>
      </section>
    )
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
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Create your account</h1>
      <p className="mt-2 leading-7 text-slate-600">
        Register to manage your internet service account.
      </p>

      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
        <Field
          autoComplete="name"
          error={fieldErrors.fullName}
          id="fullName"
          label="Full name"
          onChange={(value) => updateField('fullName', value)}
          value={values.fullName}
        />
        <Field
          autoComplete="email"
          error={fieldErrors.email}
          id="email"
          label="Email address"
          onChange={(value) => updateField('email', value)}
          type="email"
          value={values.email}
        />
        <Field
          autoComplete="new-password"
          error={fieldErrors.password}
          id="password"
          label="Password"
          helpText="Use at least 8 characters."
          onChange={(value) => updateField('password', value)}
          type="password"
          value={values.password}
        />
        <Field
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          id="confirmPassword"
          label="Confirm password"
          onChange={(value) => updateField('confirmPassword', value)}
          type="password"
          value={values.confirmPassword}
        />

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
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link className="font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/login">
            Sign in
          </Link>
        </p>
      </form>
    </section>
  )
}

interface FieldProps {
  autoComplete: string
  error?: string
  id: keyof SignupFormValues
  helpText?: string
  label: string
  onChange: (value: string) => void
  type?: 'email' | 'password' | 'text'
  value: string
}

function Field({
  autoComplete,
  error,
  id,
  helpText,
  label,
  onChange,
  type = 'text',
  value,
}: FieldProps) {
  const errorId = `${id}-error`
  const helpId = `${id}-help`

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : helpText ? helpId : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className="min-h-12 w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-2.5 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        id={id}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
      {helpText && !error ? (
        <p className="mt-1.5 text-sm text-slate-500" id={helpId}>
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
