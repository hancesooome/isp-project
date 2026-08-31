import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './auth-context'
import { getSafeRedirect } from './redirect'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, session } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <p role="status">Loading your session...</p>
  }

  if (!session) {
    const returnTo = getSafeRedirect(location.pathname)
    const searchParams = new URLSearchParams({ redirect: returnTo })

    return <Navigate replace to={`/login?${searchParams.toString()}`} />
  }

  return children
}
