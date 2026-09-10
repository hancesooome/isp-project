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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      isLoading,
      isPasswordRecovery,
      session,
      user: session?.user ?? null,
    }),
    [isLoading, isPasswordRecovery, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
