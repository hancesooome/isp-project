import { supabase } from '../lib/supabase.js'

interface OverdueInvoiceResult {
  eligibleInvoices: number
  transitionedInvoices: number
  skippedInvoices: number
}

function isOverdueInvoiceResult(
  value: unknown,
): value is OverdueInvoiceResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const result = value as Record<string, unknown>

  return (
    typeof result.eligibleInvoices === 'number' &&
    typeof result.transitionedInvoices === 'number' &&
    typeof result.skippedInvoices === 'number'
  )
}

export async function runOverdueInvoiceJob(): Promise<OverdueInvoiceResult> {
  const { data, error } = await supabase.rpc('mark_overdue_invoices')

  if (error) {
    console.error('Failed to mark overdue invoices', { code: error.code })
    throw new Error('OVERDUE_INVOICES_FAILED')
  }

  if (!isOverdueInvoiceResult(data)) {
    console.error('Failed to mark overdue invoices', {
      code: 'RESULT_NOT_FOUND',
    })
    throw new Error('OVERDUE_INVOICES_FAILED')
  }

  return data
}
