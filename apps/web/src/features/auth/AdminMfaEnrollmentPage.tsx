import { type FormEvent, useEffect, useState } from 'react'
import { LockKeyhole, LogOut, QrCode } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import { useAuth } from './auth-context'
import { fetchAdminMfaStatus } from './admin-mfa'

type PageState = 'checking' | 'ready' | 'enrolling' | 'verify' | 'saving' | 'error'

export function AdminMfaEnrollmentPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>('checking')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function checkEnrollment() {
      try {
        const mfa = await fetchAdminMfaStatus(session?.access_token ?? '', controller.signal)
        if (mfa.requirement !== 'enrollment_required') {
          navigate('/admin', { replace: true })
          return
        }
        setState('ready')
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) setState('error')
      }
    }
    void checkEnrollment()
    return () => controller.abort()
  }, [navigate, session])

  async function beginEnrollment() {
    if (state !== 'ready') return
    setState('enrolling')
    setMessage(null)
    try {
      const existing = await supabase.auth.mfa.listFactors()
      if (existing.error) throw existing.error
      for (const factor of existing.data.all) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          const removal = await supabase.auth.mfa.unenroll({ factorId: factor.id })
          if (removal.error) throw removal.error
        }
      }

      const enrollment = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'ISP Platform administrator',
      })
      if (enrollment.error) throw enrollment.error
      setFactorId(enrollment.data.id)
      setQrCode(enrollment.data.totp.qr_code)
      setState('verify')
    } catch {
      setMessage('We could not start authenticator setup. Please try again.')
      setState('ready')
    }
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state !== 'verify' || !factorId || !/^\d{6}$/.test(code)) {
      setMessage('Enter the six-digit code from your authenticator app.')
      return
    }
    setState('saving')
    setMessage(null)
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) throw challenge.error
      const verification = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      })
      if (verification.error) throw verification.error
      const refreshed = await supabase.auth.refreshSession()
      if (refreshed.error) throw refreshed.error
      navigate('/admin', { replace: true })
    } catch {
      setCode('')
      setMessage('That code could not be verified. Check your authenticator and try again.')
      setState('verify')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (state === 'checking') return <LoadingState label="Checking admin security..." />
  if (state === 'error') return <SecurityPanel><h1 className="text-2xl font-semibold text-white">Security check unavailable</h1><p className="mt-3 text-slate-300">We could not verify this administrator account. Please sign out and try again.</p><SignOutButton onClick={() => void signOut()} /></SecurityPanel>

  return (
    <SecurityPanel>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-[10px] border border-blue-400/20 bg-blue-400/10 text-blue-300"><LockKeyhole aria-hidden="true" size={21} /></span>
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-300">Administrator security</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">Set up two-factor authentication</h1></div>
      </div>
      <p className="mt-5 leading-7 text-slate-300">Administrator accounts require an authenticator app. You cannot enter the admin portal until setup is complete.</p>

      {state === 'ready' || state === 'enrolling' ? (
        <div className="mt-7 border-t border-white/10 pt-6">
          <ol className="space-y-3 text-sm leading-6 text-slate-300"><li>1. Install or open an authenticator app.</li><li>2. Start setup and scan the secure QR code.</li><li>3. Enter the six-digit code to confirm enrollment.</li></ol>
          <button className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-5 font-semibold text-white hover:bg-blue-500 disabled:opacity-60" disabled={state === 'enrolling'} onClick={() => void beginEnrollment()} type="button">{state === 'enrolling' ? <><LoadingSpinner size="sm" /> Preparing setup...</> : <><QrCode aria-hidden="true" size={18} /> Begin setup</>}</button>
        </div>
      ) : (
        <form className="mt-7 border-t border-white/10 pt-6" onSubmit={(event) => void verifyEnrollment(event)}>
          {qrCode ? <div className="mx-auto w-fit rounded-[14px] bg-white p-4"><img alt="Authenticator app enrollment QR code" className="size-52" src={qrCode} /></div> : null}
          <label className="mt-6 block text-sm font-medium text-slate-200" htmlFor="mfa-code">Authentication code</label>
          <input autoComplete="one-time-code" className="mt-2 min-h-12 w-full rounded-[10px] border border-white/12 bg-black/20 px-4 text-center font-mono text-xl tracking-[0.3em] text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" id="mfa-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} pattern="[0-9]{6}" value={code} />
          <button className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-blue-600 px-5 font-semibold text-white hover:bg-blue-500 disabled:opacity-60" disabled={state === 'saving'} type="submit">{state === 'saving' ? <><LoadingSpinner size="sm" /> Verifying...</> : 'Enable two-factor authentication'}</button>
        </form>
      )}
      {message ? <p className="mt-4 rounded-[10px] border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200" role="alert">{message}</p> : null}
      <SignOutButton onClick={() => void signOut()} />
    </SecurityPanel>
  )
}

function SecurityPanel({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto w-full max-w-lg rounded-[18px] border border-white/10 bg-[#11161f] p-7 text-slate-100 shadow-2xl sm:p-9">{children}</section>
}

function LoadingState({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-3 text-slate-300" role="status"><LoadingSpinner className="text-blue-400" size="md" /><span>{label}</span></div>
}

function SignOutButton({ onClick }: { onClick: () => void }) {
  return <button className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-white" onClick={onClick} type="button"><LogOut aria-hidden="true" size={17} /> Sign out</button>
}
