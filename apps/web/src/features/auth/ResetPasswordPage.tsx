import { type FormEvent, useState } from 'react'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { useAuth } from './auth-context'

const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be 128 characters or fewer'),
  confirmation: z.string(),
}).refine((values) => values.password === values.confirmation, {
  message: 'Passwords do not match',
  path: ['confirmation'],
})

export function ResetPasswordPage() {
  const { isLoading, isPasswordRecovery, session } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
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
    return <Panel><CheckCircle2 aria-hidden="true" className="text-emerald-600" size={42} /><p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Password updated</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Your password has been reset</h1><p className="mt-4 leading-7 text-slate-600" role="status">Sign in again with your new password. Administrator accounts will still be asked for their authenticator code.</p><Link className="public-primary-button mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] px-4 py-3 font-semibold text-white" to="/login">Return to sign in</Link></Panel>
  }

  if (!session || !isPasswordRecovery) {
    return <Panel><p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Recovery link unavailable</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">This link is invalid or expired</h1><p className="mt-4 leading-7 text-slate-600">Request a new password reset email. For security, recovery links cannot be reused.</p><Link className="public-primary-button mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] px-4 py-3 font-semibold text-white" to="/forgot-password">Request another link</Link><Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-blue-700" to="/login">Return to sign in</Link></Panel>
  }

  return (
    <Panel>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Account recovery</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Choose a new password</h1>
      <p className="mt-2 leading-7 text-slate-600">Use 8–128 characters and choose a password you don’t use elsewhere.</p>
      <form className="mt-7 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
        <PasswordField error={fieldErrors.password} id="new-password" label="New password" onChange={(value) => { setPassword(value); setFieldErrors({}); setRequestError(null) }} onToggle={() => setShowPassword((value) => !value)} show={showPassword} value={password} />
        <PasswordField error={fieldErrors.confirmation} id="confirm-new-password" label="Confirm new password" onChange={(value) => { setConfirmation(value); setFieldErrors({}); setRequestError(null) }} onToggle={() => setShowConfirmation((value) => !value)} show={showConfirmation} value={confirmation} />
        {requestError ? <p className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{requestError}</p> : null}
        <button className="public-primary-button flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={submitting} type="submit">{submitting ? <><LoadingSpinner size="sm" /> Updating password...</> : 'Reset password'}</button>
      </form>
    </Panel>
  )
}

function PasswordField({ error, id, label, onChange, onToggle, show, value }: { error?: string; id: string; label: string; onChange: (value: string) => void; onToggle: () => void; show: boolean; value: string }) {
  const errorId = `${id}-error`
  return <div><label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={id}>{label}</label><div className="relative"><input aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined} autoComplete="new-password" className="min-h-12 w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-2.5 pr-12 text-slate-950 shadow-inner shadow-slate-950/3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" id={id} maxLength={128} minLength={8} onChange={(event) => onChange(event.target.value)} type={show ? 'text' : 'password'} value={value} /><button aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute inset-y-0 right-0 grid min-w-12 place-items-center text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500" onClick={onToggle} type="button">{show ? <EyeOff aria-hidden="true" size={19} /> : <Eye aria-hidden="true" size={19} />}</button></div>{error ? <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">{error}</p> : null}</div>
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="w-full max-w-md rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9">{children}</section>
}
