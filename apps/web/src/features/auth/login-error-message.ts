import { LoginError } from './login'

export function getLoginErrorMessage(error: unknown): string {
  if (error instanceof LoginError) {
    if (error.code === 'EMAIL_NOT_CONFIRMED' || error.code === 'INVALID_CREDENTIALS') {
      return 'Invalid email or password, or the email address has not been verified.'
    }
  }

  return 'Unable to sign in right now. Please try again.'
}
