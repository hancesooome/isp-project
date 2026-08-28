import { useEffect, type ReactNode } from 'react'

import { useAuth } from './auth-context'
import { getSafeRedirect } from './redirect'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, session } = useAuth()

  useEffect(() => {
    if (!isLoading && !session) {
      const returnTo = getSafeRedirect(window.location.pathname)
      const searchParams = new URLSearchParams({ redirect: returnTo })

      window.location.replace(`/login?${searchParams.toString()}`)
    }
  }, [isLoading, session])

  if (isLoading) {
    return <p role="status">Loading your session...</p>
  }

  if (!session) {
    return <p role="status">Redirecting to login...</p>
  }

  return children
}
