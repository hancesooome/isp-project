import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './auth-context'
import { getSafeRedirect } from './redirect'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, session } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12" role="status">
        <div className="flex items-center gap-3 text-slate-300">
          <LoadingSpinner className="text-sky-400" size="md" />
          <span className="text-sm font-medium">Loading session...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    const returnTo = getSafeRedirect(`${location.pathname}${location.search}`)
    const searchParams = new URLSearchParams({ redirect: returnTo })

    return <Navigate replace to={`/login?${searchParams.toString()}`} />
  }

  return children
}
