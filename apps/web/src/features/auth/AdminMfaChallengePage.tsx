import { type FormEvent, useEffect, useState, type ReactNode } from 'react'
import { KeyRound, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { fetchAdminMfaStatus } from './admin-mfa'
import { useAuth } from './auth-context'

type PageState = 'checking' | 'ready' | 'verifying' | 'error'

export function AdminMfaChallengePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>('checking')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function checkRequirement() {
      try {
        const mfa = await fetchAdminMfaStatus(session?.access_token ?? '', controller.signal)
        if (mfa.requirement === 'enrollment_required') {
          navigate('/admin/mfa/enroll', { replace: true })
          return
        }
        if (mfa.requirement === 'verified') {
          navigate('/admin', { replace: true })
          return
        }
        setState('ready')
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) setState('error')
      }
    }

    void checkRequirement()
    return () => controller.abort()
  }, [navigate, session])

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state !== 'ready' || !/^\d{6}$/.test(code)) {
      setMessage('Enter the six-digit code from your authenticator app.')
      return
    }

    setState('verifying')
    setMessage(null)
    try {
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      const factor = factors.data.totp.find((item) => item.status === 'verified')
      if (!factor) {
        navigate('/admin/mfa/enroll', { replace: true })
        return
      }

      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challenge.error) throw challenge.error
      const verification = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code,
      })
      if (verification.error) throw verification.error
      const refreshed = await supabase.auth.refreshSession()
      if (refreshed.error) throw refreshed.error
      navigate('/admin', { replace: true })
    } catch {
      setCode('')
      setMessage('That code is invalid or expired. Open your authenticator and try again.')
      setState('ready')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (state === 'checking') {
    return <div className="flex items-center gap-3 text-slate-300" role="status"><LoadingSpinner className="text-blue-400" size="md" /><span>Checking admin security...</span></div>
  }

  if (state === 'error') {
    return <SecurityPanel><h1 className="text-2xl font-semibold text-white">Security check unavailable</h1><p className="mt-3 text-slate-300">We could not verify this administrator session. Please sign out and try again.</p><SignOutButton onClick={() => void signOut()} /></SecurityPanel>
  }

  return (
    <SecurityPanel>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-blue-400/20 bg-blue-400/10 text-blue-300"><KeyRound aria-hidden="true" size={21} /></span>
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Administrator security</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">Verify it’s you</h1></div>
      </div>
      <p className="mt-5 leading-7 text-slate-300">Enter the current six-digit code from the authenticator app linked to your administrator account.</p>
      <form className="mt-7 border-t border-white/10 pt-6" onSubmit={(event) => void verifyCode(event)}>
        <label className="block text-sm font-medium text-slate-200" htmlFor="admin-mfa-code">Authentication code</label>
        <input autoComplete="one-time-code" autoFocus className="mt-2 min-h-12 w-full rounded-[10px] border border-white/12 bg-black/20 px-4 text-center font-mono text-xl tracking-[0.3em] text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" id="admin-mfa-code" inputMode="numeric" maxLength={6} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setMessage(null) }} pattern="[0-9]{6}" value={code} />
        {message ? <p className="mt-3 rounded-[10px] border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200" role="alert">{message}</p> : null}
        <button className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-5 font-semibold text-white hover:bg-blue-500 disabled:opacity-60" disabled={state === 'verifying'} type="submit">{state === 'verifying' ? <><LoadingSpinner size="sm" /> Verifying...</> : 'Verify and continue'}</button>
      </form>
      <SignOutButton onClick={() => void signOut()} />
    </SecurityPanel>
  )
}

function SecurityPanel({ children }: { children: ReactNode }) {
  return <section className="mx-auto w-full max-w-lg rounded-[18px] border border-white/10 bg-[#11161f] p-7 text-slate-100 shadow-2xl sm:p-9">{children}</section>
}

function SignOutButton({ onClick }: { onClick: () => void }) {
  return <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-white" onClick={onClick} type="button"><LogOut aria-hidden="true" size={17} /> Sign out</button>
}
