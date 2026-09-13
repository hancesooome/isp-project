import { supabase } from '../../lib/supabase'

export interface SignupCustomerInput {
  captchaToken: string
  email: string
  fullName: string
  password: string
  redirectTo: string
}

export interface SignupCustomerResult {
  requiresEmailConfirmation: boolean
}

export async function signUpCustomer({
  captchaToken,
  email,
  fullName,
  password,
  redirectTo,
}: SignupCustomerInput): Promise<SignupCustomerResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken,
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
