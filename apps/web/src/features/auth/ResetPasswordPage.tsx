import { type FormEvent, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { buttonClassName } from '../../components/ui/button-styles'
import { supabase } from '../../lib/supabase'
import { AuthPanel } from './AuthPanel'
import { useAuth } from './auth-context'
import { PasswordField } from './PasswordField'
import { newPasswordSchema, PASSWORD_HELP_TEXT } from './password-policy'

const passwordSchema = z.object({
  password: newPasswordSchema,
  confirmation: z.string(),
}).refine((values) => values.password === values.confirmation, {
  message: 'Passwords do not match',
  path: ['confirmation'],
})

export function ResetPasswordPage() {
  const { isLoading, isPasswordRecovery, session } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmation?: string }>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !session || !isPasswordRecovery) return

    const parsed = passwordSchema.safeParse({ password, confirmation })
    if (!parsed.success) {
      const errors: { password?: string; confirmation?: string } = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if ((field === 'password' || field === 'confirmation') && !errors[field]) errors[field] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setRequestError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) {
      setRequestError('We could not reset your password. The recovery link may have expired.')
      setSubmitting(false)
      return
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
    if (signOutError) await supabase.auth.signOut({ scope: 'local' })
    setPassword('')
    setConfirmation('')
    setComplete(true)
    setSubmitting(false)
  }

  if (isLoading) {
    return <div className="flex items-center gap-3 text-slate-600" role="status"><LoadingSpinner className="text-blue-600" /><span>Validating recovery link...</span></div>
  }

  if (complete) {
    return <AuthPanel><CheckCircle2 aria-hidden="true" className="text-emerald-600" size={42} /><p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Password updated</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Your password has been reset</h1><p className="mt-4 leading-7 text-slate-600" role="status">Sign in again with your new password. Administrator accounts will still be asked for their authenticator code.</p><Link className={buttonClassName({ className: 'mt-7 w-full', size: 'lg' })} to="/login">Return to sign in</Link></AuthPanel>
  }

  if (!session || !isPasswordRecovery) {
    return <AuthPanel><p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Recovery link unavailable</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">This link is invalid or expired</h1><p className="mt-4 leading-7 text-slate-600">Request a new password reset email. For security, recovery links cannot be reused.</p><Link className={buttonClassName({ className: 'mt-7 w-full', size: 'lg' })} to="/forgot-password">Request another link</Link><Link className={buttonClassName({ className: 'mt-3 w-full', variant: 'tertiary' })} to="/login">Return to sign in</Link></AuthPanel>
  }

  return (
    <AuthPanel>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Account recovery</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Choose a new password</h1>
      <p className="mt-2 leading-7 text-slate-600">Choose a long password or passphrase you do not use elsewhere.</p>
      <form className="mt-7 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
        <PasswordField error={fieldErrors.password} helpText={PASSWORD_HELP_TEXT} id="new-password" label="New password" onChange={(value) => { setPassword(value); setFieldErrors({}); setRequestError(null) }} value={password} />
        <PasswordField error={fieldErrors.confirmation} id="confirm-new-password" label="Confirm new password" onChange={(value) => { setConfirmation(value); setFieldErrors({}); setRequestError(null) }} value={confirmation} />
        {requestError ? <p className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{requestError}</p> : null}
        <Button className="w-full" disabled={submitting} size="lg" type="submit">{submitting ? <><LoadingSpinner size="sm" /> Updating password...</> : 'Reset password'}</Button>
      </form>
    </AuthPanel>
  )
}
