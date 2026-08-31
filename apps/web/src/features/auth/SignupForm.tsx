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
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <Link
          className="mb-4 inline-block text-sm font-medium text-sky-400 hover:text-sky-300"
          to="/"
        >
          ← Back to home
        </Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
          Account created
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">Check your email</h1>
        <p className="mt-4 leading-7 text-slate-300" role="status">
          {successMessage}
        </p>
      </section>
    )
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
      <h1 className="mt-3 text-3xl font-bold text-white">Create your account</h1>
      <p className="mt-2 text-slate-400">
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
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </button>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link className="font-medium text-sky-400 hover:text-sky-300" to="/login">
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
  label: string
  onChange: (value: string) => void
  type?: 'email' | 'password' | 'text'
  value: string
}

function Field({
  autoComplete,
  error,
  id,
  label,
  onChange,
  type = 'text',
  value,
}: FieldProps) {
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
