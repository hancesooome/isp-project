import { supabase } from '../../lib/supabase'

export interface SignupCustomerInput {
  email: string
  fullName: string
  password: string
  redirectTo: string
}

export interface SignupCustomerResult {
  requiresEmailConfirmation: boolean
}

export async function signUpCustomer({
  email,
  fullName,
  password,
  redirectTo,
}: SignupCustomerInput): Promise<SignupCustomerResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: redirectTo,
    },
  })

  if (error) {
    throw new Error('SIGNUP_FAILED')
  }

  return {
    requiresEmailConfirmation: data.session === null,
  }
}
