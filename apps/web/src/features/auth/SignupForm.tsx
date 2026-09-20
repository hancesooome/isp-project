import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'

import type { ZodError } from 'zod'
import {
  signupSchema,
  type SignupFormValues,
} from './signup-schema'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { buttonClassName } from '../../components/ui/button-styles'
import { AuthField } from './AuthField'
import { AuthPanel } from './AuthPanel'
import { signUpCustomer } from './signup'
import { SocialAuthButtons } from './SocialAuthButtons'
import { PasswordField } from './PasswordField'
import { PASSWORD_HELP_TEXT } from './password-policy'
import { BotChallenge } from './BotChallenge'

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

interface SignupFormProps {
  redirectTo: string
}

export function SignupForm({ redirectTo }: SignupFormProps) {
  const [values, setValues] = useState(initialValues)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)

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

    if (!captchaToken) {
      setCaptchaError('Complete the security verification before continuing.')
      return
    }

    setFieldErrors({})
    setSubmissionError(null)
    setIsSubmitting(true)

    try {
      const verificationCallback = new URL('/auth/callback', window.location.origin)
      verificationCallback.searchParams.set('redirect', redirectTo)
      const result = await signUpCustomer({
        captchaToken,
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        password: parsed.data.password,
        redirectTo: verificationCallback.toString(),
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
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (successMessage) {
    return (
      <AuthPanel backLabel="Back to home" backTo="/">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
          Account created
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Check your email</h1>
        <p className="mt-4 leading-7 text-slate-600" role="status">
          {successMessage}
        </p>
        <Link
          className={buttonClassName({ className: 'mt-7 w-full', size: 'lg' })}
          to={`/login?${new URLSearchParams({ redirect: redirectTo }).toString()}`}
        >
          Continue to sign in
        </Link>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel backLabel="Back to home" backTo="/">
      <h1 className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Create your account</h1>
      <p className="mt-2 leading-7 text-slate-600">
        Register to manage your internet service account.
      </p>

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
          autoComplete="name"
          error={fieldErrors.fullName}
          id="fullName"
          label="Full name"
          name="fullName"
          onChange={(event) => updateField('fullName', event.target.value)}
          value={values.fullName}
        />
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
        <PasswordField
          error={fieldErrors.password}
          id="password"
          label="Password"
          helpText={PASSWORD_HELP_TEXT}
          onChange={(value) => updateField('password', value)}
          value={values.password}
        />
        <PasswordField
          error={fieldErrors.confirmPassword}
          id="confirmPassword"
          label="Confirm password"
          onChange={(value) => updateField('confirmPassword', value)}
          value={values.confirmPassword}
        />

        <BotChallenge
          action="signup"
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
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create account</span>
          )}
        </Button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link className="font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to={`/login?${new URLSearchParams({ redirect: redirectTo }).toString()}`}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthPanel>
  )
}
