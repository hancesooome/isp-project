import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Button } from '../../components/ui/Button'
import { buttonClassName } from '../../components/ui/button-styles'
import { supabase } from '../../lib/supabase'
import { AuthPanel } from './AuthPanel'
import { useAuth } from './auth-context'
import { PasswordField } from './PasswordField'
import { newPasswordSchema, PASSWORD_HELP_TEXT } from './password-policy'

export function SetPasswordPage() {
  const { isLoading, session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || submitting) return
    const parsedPassword = newPasswordSchema.safeParse(password)
    if (!parsedPassword.success) {
      setError(parsedPassword.error.issues[0]?.message ?? 'Enter a valid password.')
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password: parsedPassword.data })
    if (updateError) {
      setError('We could not set your password. The invitation may have expired.')
      setSubmitting(false)
      return
    }

    navigate('/portal', { replace: true })
  }

  if (isLoading) {
    return <div className="flex items-center gap-3 text-slate-600" role="status"><LoadingSpinner />Loading invitation…</div>
  }

  if (!session) {
    return <AuthPanel><p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Invitation unavailable</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">This invitation is invalid or expired</h1><p className="mt-3 leading-7 text-slate-600">Ask an administrator to send a new technician invitation.</p><Link className={buttonClassName({ className: 'mt-6 w-full', variant: 'secondary' })} to="/login">Return to sign in</Link></AuthPanel>
  }

  return (
    <AuthPanel>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Technician invitation</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Secure your account</h1>
      <p className="mt-2 leading-7 text-slate-600">Create a password for {session.user.email ?? 'your technician account'}.</p>
      <form className="mt-7 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
        <PasswordField helpText={PASSWORD_HELP_TEXT} id="technician-password" label="Password" onChange={(value) => { setPassword(value); setError(null) }} value={password} />
        <PasswordField id="technician-password-confirmation" label="Confirm password" onChange={(value) => { setConfirmation(value); setError(null) }} value={confirmation} />
        {error ? <p className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p> : null}
        <Button className="w-full" disabled={submitting} size="lg" type="submit">{submitting ? <><LoadingSpinner />Saving password…</> : 'Set password and continue'}</Button>
      </form>
    </AuthPanel>
  )
}
