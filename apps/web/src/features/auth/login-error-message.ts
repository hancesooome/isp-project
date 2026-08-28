import { LoginError } from './login'

export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof LoginError) {
    if (error.code === 'EMAIL_NOT_CONFIRMED') {
      return 'Please verify your email before continuing.'
    }

    if (error.code === 'INVALID_CREDENTIALS') {
      return 'Invalid email or password.'
    }
  }

  return 'Unable to sign in right now. Please try again.'
}
