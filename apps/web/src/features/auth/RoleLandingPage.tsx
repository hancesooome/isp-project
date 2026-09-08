import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
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
    return <section className="w-full max-w-md rounded-[18px] border border-slate-900/8 bg-white p-8 text-center text-slate-950 shadow-[0_18px_50px_rgba(18,25,38,0.1)]"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">Workspace unavailable</p><h1 className="mt-3 text-2xl font-semibold">We could not open your workspace</h1><p className="mt-3 text-slate-600">Please try again. Your account remains signed in.</p><Link className="mt-6 inline-flex min-h-11 items-center font-semibold text-blue-700" to="/">Return home</Link></section>
  }

  return <section className="text-center text-slate-950" role="status"><LoadingSpinner className="mx-auto text-blue-600" size="lg" /><h1 className="mt-5 text-xl font-semibold">Preparing your workspace</h1><p className="mt-2 text-sm text-slate-600">You’ll be taken to the right portal automatically.</p></section>
}

function isPortalResponse(value: unknown): value is { role: AccountRole; destination: string } {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (result.role === 'customer' || result.role === 'admin' || result.role === 'technician') && typeof result.destination === 'string'
}
