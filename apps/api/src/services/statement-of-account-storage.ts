import { env } from '../config/env.js'
import { supabase } from '../lib/supabase.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const statementOfAccountStorage = supabase.storage.from(
  env.soaStorageBucket,
)

export function buildStatementOfAccountPath(
  userId: string,
  year: number,
  month: number,
): string {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error('A valid customer id is required')
  }

  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error('A valid billing year is required')
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('A valid billing month is required')
  }

  const paddedMonth = String(month).padStart(2, '0')

  return `${userId}/${year}/${paddedMonth}/statement-of-account.pdf`
}
