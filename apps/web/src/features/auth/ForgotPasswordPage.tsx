import { type FormEvent, useState } from 'react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'

const recoverySchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
})

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const result = recoverySchema.safeParse({ email })
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message ?? 'Enter a valid email address')
      return
    }

    setEmailError(null)
    setIsSubmitting(true)
    try {
      const redirectTo = new URL('/auth/reset-password', window.location.origin).toString()
      const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, {
        redirectTo,
      })
      if (error) throw error
      setSubmitted(true)
    } catch {
      // Keep the response indistinguishable for unknown, rate-limited, and
      // temporarily unavailable accounts. Supabase owns recovery delivery.
      setSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Panel>
        <span className="grid size-12 place-items-center rounded-[12px] border border-emerald-200 bg-emerald-50 text-emerald-700"><MailCheck aria-hidden="true" size={23} /></span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Request received</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Check your email</h1>
        <p className="mt-4 leading-7 text-slate-600" role="status">If an account exists for this email, password reset instructions will be sent.</p>
        <p className="mt-3 text-sm leading-6 text-slate-500">The message may take a few minutes. Check your spam folder before requesting another email.</p>
        <Link className="public-primary-button mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] px-4 py-3 font-semibold text-white shadow-lg shadow-blue-950/15" to="/login">Return to sign in</Link>
      </Panel>
    )
  }

  return (
    <Panel>
      <Link className="mb-7 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-slate-600 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" to="/login"><ArrowLeft aria-hidden="true" size={16} /> Back to sign in</Link>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Account recovery</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Reset your password</h1>
      <p className="mt-2 leading-7 text-slate-600">Enter your account email and we’ll send password reset instructions.</p>

      <form className="mt-7" noValidate onSubmit={(event) => void submitRequest(event)}>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="recovery-email">Email address</label>
        <input aria-describedby={emailError ? 'recovery-email-error' : undefined} aria-invalid={emailError ? true : undefined} autoComplete="email" autoFocus className="min-h-12 w-full rounded-[10px] border border-slate-900/14 bg-white px-3.5 py-2.5 text-slate-950 shadow-inner shadow-slate-950/3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" id="recovery-email" name="email" onChange={(event) => { setEmail(event.target.value); setEmailError(null) }} type="email" value={email} />
        {emailError ? <p className="mt-1.5 text-sm text-red-700" id="recovery-email-error" role="alert">{emailError}</p> : null}
        <button className="public-primary-button mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 font-semibold text-white shadow-lg shadow-blue-950/15 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? <><LoadingSpinner size="sm" /> Sending...</> : 'Send reset instructions'}</button>
      </form>
    </Panel>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="w-full max-w-md rounded-[18px] border border-slate-900/8 bg-white p-7 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)] sm:p-9">{children}</section>
}
