import type { Session } from '@supabase/supabase-js'
import {
  type PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      session,
      user: session?.user ?? null,
    }),
    [isLoading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
