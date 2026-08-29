import { useEffect, useState, type ReactNode } from 'react'

import { useAuth } from './auth-context'

interface AdminRouteProps {
  children: ReactNode
}

type AdminAccessState = 'checking' | 'allowed' | 'denied' | 'error'

export function AdminRoute({ children }: AdminRouteProps) {
  const { session } = useAuth()
  const [access, setAccess] = useState<AdminAccessState>('checking')

  useEffect(() => {
    if (!session) {
      return
    }

    const controller = new AbortController()

    async function verifyAdminAccess() {
      try {
        const response = await fetch('/api/admin/access', {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          signal: controller.signal,
        })

        if (response.status === 403) {
          setAccess('denied')
          return
        }

        if (!response.ok) {
          throw new Error('ADMIN_ACCESS_CHECK_FAILED')
        }

        setAccess('allowed')
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        setAccess('error')
      }
    }

    void verifyAdminAccess()
    return () => controller.abort()
  }, [session])

  if (access === 'checking') {
    return <p role="status">Checking admin access...</p>
  }

  if (access === 'denied') {
    return (
      <section className="w-full max-w-md rounded-2xl border border-red-900 bg-red-950/40 p-8 text-center">
        <h1 className="text-3xl font-bold text-white">Access denied</h1>
        <p className="mt-3 text-red-200">
          Your account does not have permission to view this page.
        </p>
        <a
          className="mt-6 inline-block font-medium text-sky-400 hover:text-sky-300"
          href="/account"
        >
          Return to account
        </a>
      </section>
    )
  }

  if (access === 'error') {
    return (
      <p
        className="w-full max-w-md rounded-xl border border-red-900 bg-red-950/50 p-5 text-center text-red-200"
        role="alert"
      >
        We could not verify admin access. Please try again later.
      </p>
    )
  }

  return children
}
