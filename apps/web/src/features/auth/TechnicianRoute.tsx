import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAuth } from './auth-context'

export function TechnicianRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied' | 'error'>('checking')

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    async function verifyAccess() {
      try {
        const response = await fetch('/api/technician/access', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          signal: controller.signal,
        })
        if (response.status === 403) { setAccess('denied'); return }
        if (!response.ok) throw new Error('TECHNICIAN_ACCESS_CHECK_FAILED')
        setAccess('allowed')
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) setAccess('error')
      }
    }
    void verifyAccess()
    return () => controller.abort()
  }, [session])

  if (access === 'checking') return <div className="flex min-h-screen items-center justify-center gap-3 bg-[#0a0d12] text-slate-300" role="status"><LoadingSpinner className="text-blue-400" size="md" />Checking technician access…</div>
  if (access === 'denied') return <div className="flex min-h-screen items-center justify-center bg-[#0a0d12] px-5"><section className="max-w-md text-center"><h1 className="text-2xl font-semibold text-white">Technician access required</h1><p className="mt-3 text-slate-400">This account is not registered as a technician.</p><Link className="mt-6 inline-block font-semibold text-blue-300" to="/portal">Open my workspace</Link></section></div>
  if (access === 'error') return <div className="flex min-h-screen items-center justify-center bg-[#0a0d12] px-5 text-center text-red-300" role="alert">We could not verify technician access. Please try again.</div>
  return children
}
