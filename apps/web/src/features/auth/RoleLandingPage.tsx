import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { buttonClassName } from '../../components/ui/button-styles'
import { AuthPanel } from './AuthPanel'
import { useAuth } from './auth-context'
import { getDestinationForRole, getSafeRedirect } from './redirect'

type AccountRole = 'customer' | 'admin' | 'technician'

export function RoleLandingPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(false)
  const requestedDestination = getSafeRedirect(searchParams.get('redirect'))

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()

    async function openPortal() {
      try {
        const response = await fetch('/api/auth/portal', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        const result: unknown = await response.json()
        if (!response.ok || !isPortalResponse(result)) throw new Error('PORTAL_LOOKUP_FAILED')
        navigate(getDestinationForRole(result.role, requestedDestination), { replace: true })
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return
        setError(true)
      }
    }

    void openPortal()
    return () => controller.abort()
  }, [navigate, requestedDestination, session])

  if (error) {
    return <AuthPanel className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Workspace unavailable</p><h1 className="mt-3 text-2xl font-semibold">We could not open your workspace</h1><p className="mt-3 text-slate-600">Please try again. Your account remains signed in.</p><Link className={buttonClassName({ className: 'mt-6 w-full', variant: 'secondary' })} to="/">Return home</Link></AuthPanel>
  }

  return <AuthPanel className="text-center"><div role="status"><LoadingSpinner className="mx-auto text-blue-600" size="lg" /><h1 className="mt-5 text-xl font-semibold">Preparing your workspace</h1><p className="mt-2 text-sm text-slate-600">You’ll be taken to the right portal automatically.</p></div></AuthPanel>
}

function isPortalResponse(value: unknown): value is { role: AccountRole; destination: string } {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (result.role === 'customer' || result.role === 'admin' || result.role === 'technician') && typeof result.destination === 'string'
}
