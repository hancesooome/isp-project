import { useEffect } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { buttonClassName } from '../../components/ui/button-styles'
import { AuthPanel } from './AuthPanel'
import { useAuth } from './auth-context'
import { getRoleLandingPath, getSafeRedirect } from './redirect'

export function OAuthCallbackPage() {
  const { isLoading, session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const hashParams = new URLSearchParams(location.hash.includes('?') ? location.hash.split('?')[1] : location.hash.slice(1))
  const destination = getSafeRedirect(searchParams.get('redirect') ?? hashParams.get('redirect'))
  const providerError =
    searchParams.get('error_description') ?? hashParams.get('error_description')

  useEffect(() => {
    if (session) {
      navigate(getRoleLandingPath(destination), { replace: true })
    }
  }, [destination, navigate, session])

  if (!providerError && (isLoading || session)) {
    return (
      <AuthPanel className="text-center">
        <div role="status"><LoadingSpinner className="mx-auto" /><h1 className="mt-5 text-xl font-semibold">Finishing sign in</h1><p className="mt-2 text-sm text-slate-600">Securely connecting your account…</p></div>
      </AuthPanel>
    )
  }

  return (
    <AuthPanel>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Sign-in interrupted</p>
      <h1 className="mt-3 text-2xl font-semibold">We could not complete sign in</h1>
      <p className="mt-3 leading-7 text-slate-600">We could not verify the sign-in response. Please return to sign in and try again.</p>
      <Link className={buttonClassName({ className: 'mt-6 w-full', size: 'lg' })} to={`/login?${new URLSearchParams({ redirect: destination }).toString()}`}>
        Return to sign in
      </Link>
    </AuthPanel>
  )
}
