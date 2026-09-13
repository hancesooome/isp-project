import { env } from '../config/env.js'

import { sendEmail } from './email.js'
import { formatMoney } from './money.js'
import { supabase } from './supabase.js'
import { buildTransactionalEmail } from './transactional-email.js'

export async function sendInvoiceCreatedEmail(invoiceId: string): Promise<boolean> {
  const claimedAt = new Date().toISOString()
  const { data: invoice, error: claimError } = await supabase
    .from('invoices')
    .update({ invoice_created_email_claimed_at: claimedAt })
    .eq('id', invoiceId)
    .eq('status', 'open')
    .is('invoice_created_email_claimed_at', null)
    .select('id, user_id, amount_cents, currency, due_date')
    .maybeSingle<{
      id: string
      user_id: string
      amount_cents: number
      currency: string
      due_date: string
    }>()

  if (claimError || !invoice) {
    if (claimError) {
      console.error('Failed to claim invoice-created email', {
        code: claimError.code,
        invoiceId,
      })
    }
    return false
  }

  if (invoice.currency !== 'PHP') {
    console.error('Refused non-PHP billing email', { invoiceId })
    await releaseInvoiceEmailClaim(invoice.id, claimedAt)
    return false
  }

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(invoice.user_id)
  const email = userData.user?.email

  if (userError || !email) {
    console.error('Failed to load invoice customer email', {
      code: userError?.code ?? 'EMAIL_NOT_FOUND',
      invoiceId,
    })
    await releaseInvoiceEmailClaim(invoice.id, claimedAt)
    return false
  }

  const reference = invoice.id.slice(0, 8).toUpperCase()
  const result = await sendEmail({
    to: email,
    subject: `Invoice #${reference} is ready`,
    ...buildTransactionalEmail({
      preheader: `Your invoice for ${formatMoney(invoice.amount_cents)} is ready.`,
      headline: 'Your invoice is ready',
      paragraphs: ['A new invoice has been added to your ISP Platform account.'],
      details: [
        { label: 'Invoice', value: `#${reference}` },
        { label: 'Amount due', value: formatMoney(invoice.amount_cents) },
        { label: 'Currency', value: 'PHP' },
        { label: 'Due date', value: invoice.due_date },
      ],
      action: {
        label: 'View or pay invoice',
        url: new URL(
          `/account/invoices/${encodeURIComponent(invoice.id)}`,
          env.appUrl,
        ).toString(),
      },
    }),
  })

  if (result.success) return true

  await releaseInvoiceEmailClaim(invoice.id, claimedAt)
  return false
}

async function releaseInvoiceEmailClaim(invoiceId: string, claimedAt: string) {
  const { error } = await supabase
    .from('invoices')
    .update({ invoice_created_email_claimed_at: null })
    .eq('id', invoiceId)
    .eq('invoice_created_email_claimed_at', claimedAt)

  if (error) {
    console.error('Failed to release invoice-created email claim', {
      code: error.code,
      invoiceId,
    })
  }
}
