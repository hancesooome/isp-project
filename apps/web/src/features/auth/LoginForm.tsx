import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import type { ZodError } from 'zod'
import { getLoginErrorMessage } from './login-error-message'
import { loginSchema, type LoginFormValues } from './login-schema'
import { loginWithPassword } from './login'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { AuthField } from './AuthField'
import { AuthPanel } from './AuthPanel'
import { SocialAuthButtons } from './SocialAuthButtons'
import { BotChallenge } from './BotChallenge'

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)

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

    if (!captchaToken) {
      setCaptchaError('Complete the security verification before continuing.')
      return
    }

    setFieldErrors({})
    setSubmissionError(null)
    setIsSubmitting(true)

    try {
      await loginWithPassword(parsed.data.email, parsed.data.password, captchaToken)
      setValues(initialValues)
      onSignedIn(redirectTo)
    } catch (error) {
      setValues((current) => ({ ...current, password: '' }))
      setSubmissionError(getLoginErrorMessage(error))
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPanel backLabel="Back to home" backTo="/">
      <h1 className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Welcome back</h1>
      <p className="mt-2 text-slate-600">Sign in to manage your account.</p>

      <div className="mt-7">
        <SocialAuthButtons disabled={isSubmitting} redirectTo={redirectTo} />
      </div>

      <div className="my-7 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-slate-900/10" />
        <span className="text-xs font-medium text-slate-500">or use email</span>
        <span className="h-px flex-1 bg-slate-900/10" />
      </div>

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <AuthField
            autoComplete="email"
            error={fieldErrors.email}
            id="email"
            label="Email address"
            name="email"
            onChange={(event) => updateField('email', event.target.value)}
            type="email"
            value={values.email}
        />

        <AuthField
            autoComplete="current-password"
            error={fieldErrors.password}
            id="password"
            label="Password"
            name="password"
            onChange={(event) => updateField('password', event.target.value)}
            type="password"
            value={values.password}
        />

        <Link className="block text-sm font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/forgot-password">
          Forgot password?
        </Link>

        <BotChallenge
          action="login"
          error={captchaError}
          onError={(message) => setCaptchaError(message || null)}
          onToken={setCaptchaToken}
          resetKey={captchaResetKey}
        />

        {submissionError ? (
          <p className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            {submissionError}
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={isSubmitting || !captchaToken}
          size="lg"
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
        </Button>

        <p className="text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link className="font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to={`/signup?${new URLSearchParams({ redirect: redirectTo }).toString()}`}>
            Create account
          </Link>
        </p>
      </form>
    </AuthPanel>
  )
}
