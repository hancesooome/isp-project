import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_HELP_TEXT = `Use at least ${PASSWORD_MIN_LENGTH} characters. Long passphrases are welcome.`

export const newPasswordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  )
