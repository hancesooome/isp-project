import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export type LoginErrorCode =
  | 'CAPTCHA_FAILED'
  | 'EMAIL_NOT_CONFIRMED'
  | 'INVALID_CREDENTIALS'
  | 'UNAVAILABLE'

export class LoginError extends Error {
  constructor(readonly code: LoginErrorCode) {
    super(code)
    this.name = 'LoginError'
  }
}

export async function loginWithPassword(
  email: string,
  password: string,
  captchaToken: string,
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  })

  if (error) {
    if (error.code === 'captcha_failed') {
      throw new LoginError('CAPTCHA_FAILED')
    }
    if (error.code === 'email_not_confirmed') {
      throw new LoginError('EMAIL_NOT_CONFIRMED')
    }

    if (error.code === 'invalid_credentials') {
      throw new LoginError('INVALID_CREDENTIALS')
    }

    throw new LoginError('UNAVAILABLE')
  }

  if (!data.session) {
    throw new LoginError('UNAVAILABLE')
  }

  return data.session
}
