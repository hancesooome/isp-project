import { env } from '../config/env.js'
import { sendEmail } from '../lib/email.js'
import { formatMoney } from '../lib/money.js'
import { supabase } from '../lib/supabase.js'

interface EligibleInvoice {
  id: string
  user_id: string
  amount_cents: number
  due_date: string
}

interface UpcomingDueReminderResult {
  eligibleInvoices: number
  sentReminders: number
  skippedReminders: number
}

function toDatabaseDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function runUpcomingDueReminderJob(
  now = new Date(),
): Promise<UpcomingDueReminderResult> {
  const today = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ))
  const reminderEnd = new Date(today)
  reminderEnd.setUTCDate(reminderEnd.getUTCDate() + env.dueReminderDays)

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, user_id, amount_cents, due_date')
    .eq('status', 'open')
    .is('due_reminder_email_claimed_at', null)
    .gte('due_date', toDatabaseDate(today))
    .lte('due_date', toDatabaseDate(reminderEnd))
    .order('due_date')
    .order('id')
    .returns<EligibleInvoice[]>()

  if (error) {
    console.error('Failed to load upcoming-due invoices', { code: error.code })
    throw new Error('UPCOMING_DUE_INVOICES_FAILED')
  }

  let sentReminders = 0
  let skippedReminders = 0

  for (const invoice of invoices) {
    const claimedAt = new Date().toISOString()
    const { data: claimedInvoice, error: claimError } = await supabase
      .from('invoices')
      .update({ due_reminder_email_claimed_at: claimedAt })
      .eq('id', invoice.id)
      .eq('status', 'open')
      .is('due_reminder_email_claimed_at', null)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (claimError) {
      console.error('Failed to claim upcoming-due reminder', {
        code: claimError.code,
        invoiceId: invoice.id,
      })
      skippedReminders += 1
      continue
    }

    if (!claimedInvoice) {
      skippedReminders += 1
      continue
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(invoice.user_id)
    const email = userData.user?.email

    if (userError || !email) {
      console.error('Failed to load reminder customer email', {
        code: userError?.code ?? 'EMAIL_NOT_FOUND',
        invoiceId: invoice.id,
        userId: invoice.user_id,
      })
      await releaseReminderClaim(invoice.id, claimedAt)
      skippedReminders += 1
      continue
    }

    const invoiceUrl = new URL(
      `/account/invoices/${encodeURIComponent(invoice.id)}`,
      env.appUrl,
    ).toString()
    const amount = formatMoney(invoice.amount_cents)
    const result = await sendEmail({
      to: email,
      subject: `Payment reminder: ${amount} due ${invoice.due_date}`,
      text: `Your invoice for ${amount} is due on ${invoice.due_date}. View your invoice: ${invoiceUrl}`,
      html: `<p>Your invoice for <strong>${amount}</strong> is due on ${invoice.due_date}.</p><p><a href="${invoiceUrl}">View your invoice</a></p>`,
    })

    if (result.success) {
      sentReminders += 1
      continue
    }

    await releaseReminderClaim(invoice.id, claimedAt)
    skippedReminders += 1
  }

  return {
    eligibleInvoices: invoices.length,
    sentReminders,
    skippedReminders,
  }
}

async function releaseReminderClaim(invoiceId: string, claimedAt: string) {
  const { error } = await supabase
    .from('invoices')
    .update({ due_reminder_email_claimed_at: null })
    .eq('id', invoiceId)
    .eq('due_reminder_email_claimed_at', claimedAt)

  if (error) {
    console.error('Failed to release upcoming-due reminder claim', {
      code: error.code,
      invoiceId,
    })
  }
}
