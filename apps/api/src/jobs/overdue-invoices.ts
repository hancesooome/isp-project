import { env } from '../config/env.js'
import { sendEmail } from '../lib/email.js'
import { formatMoney } from '../lib/money.js'
import { supabase } from '../lib/supabase.js'

interface OverdueInvoiceResult {
  eligibleInvoices: number
  transitionedInvoices: number
  skippedInvoices: number
  eligibleSubscriptions: number
  transitionedSubscriptions: number
  skippedSubscriptions: number
  eligibleNotifications: number
  sentNotifications: number
  skippedNotifications: number
  eligibleDelinquencyNotifications: number
  sentDelinquencyNotifications: number
  skippedDelinquencyNotifications: number
}

interface OverdueTransitionResult {
  eligibleInvoices: number
  transitionedInvoices: number
  skippedInvoices: number
  eligibleSubscriptions: number
  transitionedSubscriptions: number
  skippedSubscriptions: number
}

interface OverdueInvoice {
  id: string
  user_id: string
  amount_cents: number
  due_date: string
}

interface DelinquencyNotification {
  id: string
  subscription_id: string
  triggering_invoice_id: string
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
    typeof result.skippedInvoices === 'number' &&
    typeof result.eligibleSubscriptions === 'number' &&
    typeof result.transitionedSubscriptions === 'number' &&
    typeof result.skippedSubscriptions === 'number'
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
  const delinquencyNotifications = await sendDelinquencyNotifications()

  return { ...data, ...notifications, ...delinquencyNotifications }
}

async function sendDelinquencyNotifications() {
  const { data: history, error } = await supabase
    .from('subscription_delinquency_history')
    .select('id, subscription_id, triggering_invoice_id')
    .is('email_claimed_at', null)
    .order('delinquent_at')
    .order('id')
    .returns<DelinquencyNotification[]>()

  if (error) {
    console.error('Failed to load delinquency notifications', {
      code: error.code,
    })
    throw new Error('DELINQUENCY_NOTIFICATIONS_FAILED')
  }

  let sentDelinquencyNotifications = 0
  let skippedDelinquencyNotifications = 0

  for (const notification of history) {
    const claimedAt = new Date().toISOString()
    const { data: claimedHistory, error: claimError } = await supabase
      .from('subscription_delinquency_history')
      .update({ email_claimed_at: claimedAt })
      .eq('id', notification.id)
      .is('email_claimed_at', null)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (claimError || !claimedHistory) {
      if (claimError) {
        console.error('Failed to claim delinquency notification', {
          code: claimError.code,
          historyId: notification.id,
        })
      }
      skippedDelinquencyNotifications += 1
      continue
    }

    const [subscriptionResult, invoiceResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('user_id')
        .eq('id', notification.subscription_id)
        .eq('status', 'past_due')
        .maybeSingle<{ user_id: string }>(),
      supabase
        .from('invoices')
        .select('id, amount_cents, due_date')
        .eq('id', notification.triggering_invoice_id)
        .maybeSingle<{ id: string; amount_cents: number; due_date: string }>(),
    ])

    if (
      subscriptionResult.error ||
      invoiceResult.error ||
      !subscriptionResult.data ||
      !invoiceResult.data
    ) {
      console.error('Failed to load delinquency notification details', {
        historyId: notification.id,
        subscriptionCode: subscriptionResult.error?.code,
        invoiceCode: invoiceResult.error?.code,
      })
      await releaseDelinquencyNotificationClaim(notification.id, claimedAt)
      skippedDelinquencyNotifications += 1
      continue
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(subscriptionResult.data.user_id)
    const email = userData.user?.email

    if (userError || !email) {
      console.error('Failed to load delinquent customer email', {
        code: userError?.code ?? 'EMAIL_NOT_FOUND',
        historyId: notification.id,
      })
      await releaseDelinquencyNotificationClaim(notification.id, claimedAt)
      skippedDelinquencyNotifications += 1
      continue
    }

    const invoice = invoiceResult.data
    const reference = invoice.id.slice(0, 8).toUpperCase()
    const amount = formatMoney(invoice.amount_cents)
    const invoiceUrl = new URL(
      `/account/invoices/${encodeURIComponent(invoice.id)}`,
      env.appUrl,
    ).toString()
    const result = await sendEmail({
      to: email,
      subject: 'Your ISP account is past due',
      text: `Your account is now past due because invoice #${reference} for ${amount}, due on ${invoice.due_date}, remains unpaid after the 3-day grace period. Your service has not been suspended. View or pay your invoice: ${invoiceUrl}`,
      html: `<p>Your account is now <strong>past due</strong> because invoice <strong>#${reference}</strong> for <strong>${amount}</strong>, due on ${invoice.due_date}, remains unpaid after the 3-day grace period.</p><p>Your service has not been suspended.</p><p><a href="${invoiceUrl}">View or pay your invoice</a></p>`,
    })

    if (result.success) {
      sentDelinquencyNotifications += 1
      continue
    }

    await releaseDelinquencyNotificationClaim(notification.id, claimedAt)
    skippedDelinquencyNotifications += 1
  }

  return {
    eligibleDelinquencyNotifications: history.length,
    sentDelinquencyNotifications,
    skippedDelinquencyNotifications,
  }
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
    const amount = formatMoney(invoice.amount_cents)
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

async function releaseDelinquencyNotificationClaim(
  historyId: string,
  claimedAt: string,
) {
  const { error } = await supabase
    .from('subscription_delinquency_history')
    .update({ email_claimed_at: null })
    .eq('id', historyId)
    .eq('email_claimed_at', claimedAt)

  if (error) {
    console.error('Failed to release delinquency notification claim', {
      code: error.code,
      historyId,
    })
  }
}
