import { env } from '../config/env.js'
import { supabase } from '../lib/supabase.js'
import { generateStatementOfAccountPdf } from './statement-of-account-pdf.js'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const statementOfAccountStorage = supabase.storage.from(
  env.soaStorageBucket,
)

export interface StoredStatementOfAccount {
  id: string
  user_id: string
  billing_period_start: string
  billing_period_end: string
  storage_key: string
  created_at: string
}

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

function getBillingPeriod(year: number, month: number): {
  start: string
  end: string
} {
  const paddedMonth = String(month).padStart(2, '0')
  const lastDay = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10)

  return {
    start: `${year}-${paddedMonth}-01`,
    end: lastDay,
  }
}

async function findStoredStatement(
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<StoredStatementOfAccount | null> {
  const { data, error } = await supabase
    .from('statements_of_account')
    .select(
      'id, user_id, billing_period_start, billing_period_end, storage_key, created_at',
    )
    .eq('user_id', userId)
    .eq('billing_period_start', periodStart)
    .eq('billing_period_end', periodEnd)
    .maybeSingle<StoredStatementOfAccount>()

  if (error) {
    console.error('Failed to load stored statement reference', {
      code: error.code,
      userId,
    })
    throw new Error('STATEMENT_REFERENCE_LOOKUP_FAILED')
  }

  return data
}

export async function generateAndStoreStatementOfAccountPdf(
  userId: string,
  year: number,
  month: number,
): Promise<StoredStatementOfAccount | null> {
  const storageKey = buildStatementOfAccountPath(userId, year, month)
  const period = getBillingPeriod(year, month)
  const existingStatement = await findStoredStatement(
    userId,
    period.start,
    period.end,
  )

  if (existingStatement) {
    return existingStatement
  }

  const pdf = await generateStatementOfAccountPdf(userId)

  if (!pdf) {
    return null
  }

  const { error: uploadError } = await statementOfAccountStorage.upload(
    storageKey,
    pdf,
    {
      contentType: 'application/pdf',
      upsert: false,
    },
  )

  if (uploadError) {
    const statementCreatedByAnotherRequest = await findStoredStatement(
      userId,
      period.start,
      period.end,
    )

    if (statementCreatedByAnotherRequest) {
      return statementCreatedByAnotherRequest
    }

    console.error('Failed to upload statement of account PDF', {
      statusCode: uploadError.statusCode,
      userId,
    })
    throw new Error('STATEMENT_UPLOAD_FAILED')
  }

  const { data: statement, error: insertError } = await supabase
    .from('statements_of_account')
    .insert({
      user_id: userId,
      billing_period_start: period.start,
      billing_period_end: period.end,
      storage_key: storageKey,
    })
    .select(
      'id, user_id, billing_period_start, billing_period_end, storage_key, created_at',
    )
    .single<StoredStatementOfAccount>()

  if (insertError) {
    const { error: cleanupError } = await statementOfAccountStorage.remove([
      storageKey,
    ])

    console.error('Failed to save statement of account reference', {
      code: insertError.code,
      cleanupFailed: Boolean(cleanupError),
      userId,
    })
    throw new Error('STATEMENT_REFERENCE_SAVE_FAILED')
  }

  return statement
}
