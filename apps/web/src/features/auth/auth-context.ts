import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export interface AuthState {
  isLoading: boolean
  session: Session | null
  user: User | null
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return value
}
