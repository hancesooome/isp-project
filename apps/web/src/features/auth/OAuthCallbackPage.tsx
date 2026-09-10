import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from './auth-context'
import { getRoleLandingPath, getSafeRedirect } from './redirect'

export function OAuthCallbackPage() {
  const { isLoading, session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const destination = getSafeRedirect(searchParams.get('redirect'))
  const hashParams = new URLSearchParams(location.hash.slice(1))
  const providerError =
    searchParams.get('error_description') ?? hashParams.get('error_description')

  useEffect(() => {
    if (session) {
      navigate(getRoleLandingPath(destination), { replace: true })
    }
  }, [destination, navigate, session])

  if (!providerError && (isLoading || session)) {
    return (
      <section className="w-full max-w-md rounded-[18px] border border-slate-900/8 bg-white p-8 text-center text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)]" role="status">
        <LoadingSpinner className="mx-auto" />
        <h1 className="mt-5 text-xl font-semibold">Finishing sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Securely connecting your account…</p>
      </section>
    )
  }

  return (
    <section className="w-full max-w-md rounded-[18px] border border-slate-900/8 bg-white p-8 text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Sign-in interrupted</p>
      <h1 className="mt-3 text-2xl font-semibold">We could not complete sign in</h1>
      <p className="mt-3 leading-7 text-slate-600">We could not verify the sign-in response. Please return to sign in and try again.</p>
      <Link className="public-primary-button mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] px-4 py-3 font-semibold text-white" to={`/login?${new URLSearchParams({ redirect: destination }).toString()}`}>
        Return to sign in
      </Link>
    </section>
  )
}
