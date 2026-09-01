import { env } from '../config/env.js'
import { sendEmail } from '../lib/email.js'
import { supabase } from '../lib/supabase.js'

interface OverdueInvoiceResult {
  eligibleInvoices: number
  transitionedInvoices: number
  skippedInvoices: number
  eligibleNotifications: number
  sentNotifications: number
  skippedNotifications: number
}

interface OverdueTransitionResult {
  eligibleInvoices: number
  transitionedInvoices: number
  skippedInvoices: number
}

interface OverdueInvoice {
  id: string
  user_id: string
  amount_cents: number
  due_date: string
}

function isOverdueTransitionResult(
  value: unknown,
): value is OverdueTransitionResult {
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

  if (!isOverdueTransitionResult(data)) {
    console.error('Failed to mark overdue invoices', {
      code: 'RESULT_NOT_FOUND',
    })
    throw new Error('OVERDUE_INVOICES_FAILED')
  }

  const notifications = await sendOverdueNotifications()

  return { ...data, ...notifications }
}

async function sendOverdueNotifications() {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, user_id, amount_cents, due_date')
    .eq('status', 'overdue')
    .is('overdue_email_claimed_at', null)
    .order('due_date')
    .order('id')
    .returns<OverdueInvoice[]>()

  if (error) {
    console.error('Failed to load overdue invoice notifications', {
      code: error.code,
    })
    throw new Error('OVERDUE_NOTIFICATIONS_FAILED')
  }

  let sentNotifications = 0
  let skippedNotifications = 0

  for (const invoice of invoices) {
    const claimedAt = new Date().toISOString()
    const { data: claimedInvoice, error: claimError } = await supabase
      .from('invoices')
      .update({ overdue_email_claimed_at: claimedAt })
      .eq('id', invoice.id)
      .eq('status', 'overdue')
      .is('overdue_email_claimed_at', null)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (claimError) {
      console.error('Failed to claim overdue invoice notification', {
        code: claimError.code,
        invoiceId: invoice.id,
      })
      skippedNotifications += 1
      continue
    }

    if (!claimedInvoice) {
      skippedNotifications += 1
      continue
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(invoice.user_id)
    const email = userData.user?.email

    if (userError || !email) {
      console.error('Failed to load overdue invoice customer email', {
        code: userError?.code ?? 'EMAIL_NOT_FOUND',
        invoiceId: invoice.id,
        userId: invoice.user_id,
      })
      await releaseNotificationClaim(invoice.id, claimedAt)
      skippedNotifications += 1
      continue
    }

    const reference = invoice.id.slice(0, 8).toUpperCase()
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: env.stripeCurrency.toUpperCase(),
    }).format(invoice.amount_cents / 100)
    const invoiceUrl = new URL(
      `/account/invoices/${encodeURIComponent(invoice.id)}`,
      env.appUrl,
    ).toString()
    const result = await sendEmail({
      to: email,
      subject: `Invoice #${reference} is overdue`,
      text: `Invoice #${reference} for ${amount} was due on ${invoice.due_date} and is now overdue. View or pay your invoice: ${invoiceUrl}`,
      html: `<p>Invoice <strong>#${reference}</strong> for <strong>${amount}</strong> was due on ${invoice.due_date} and is now overdue.</p><p><a href="${invoiceUrl}">View or pay your invoice</a></p>`,
    })

    if (result.success) {
      sentNotifications += 1
      continue
    }

    await releaseNotificationClaim(invoice.id, claimedAt)
    skippedNotifications += 1
  }

  return {
    eligibleNotifications: invoices.length,
    sentNotifications,
    skippedNotifications,
  }
}

async function releaseNotificationClaim(invoiceId: string, claimedAt: string) {
  const { error } = await supabase
    .from('invoices')
    .update({ overdue_email_claimed_at: null })
    .eq('id', invoiceId)
    .eq('overdue_email_claimed_at', claimedAt)

  if (error) {
    console.error('Failed to release overdue invoice notification claim', {
      code: error.code,
      invoiceId,
    })
  }
}
