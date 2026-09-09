import { env } from '../config/env.js'
import { sendEmail } from '../lib/email.js'
import { supabase } from '../lib/supabase.js'
import { generateAndStoreStatementOfAccountPdf } from '../services/statement-of-account-storage.js'
import { applyScheduledPlanChanges } from './apply-plan-changes.js'
import { applyScheduledTerminations } from './scheduled-terminations.js'

interface BillingSubscription {
  id: string
  user_id: string
  activated_at: string
  billing_anchor_date: string
  plan: { price_cents: unknown; billing_interval: unknown; currency: unknown }
}

interface MonthlyBillingResult {
  generatedInvoices: number
  skippedInvoices: number
  processedStatements: number
  sentStatementEmails: number
}

interface BillingPeriod { start: string; end: string; dueDate: string }

export function calculateMonthlyCharge(plan: BillingSubscription['plan']): number {
  if (plan.currency !== 'PHP') throw new Error('MONTHLY_BILLING_CURRENCY_INVALID')
  if (plan.billing_interval !== 'monthly') throw new Error('MONTHLY_BILLING_INTERVAL_INVALID')
  if (typeof plan.price_cents !== 'number' || !Number.isSafeInteger(plan.price_cents) || plan.price_cents < 0 || plan.price_cents > 2_147_483_647) {
    throw new Error('MONTHLY_BILLING_PRICE_INVALID')
  }
  return plan.price_cents
}

function parseDatabaseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day!))
}

function toDatabaseDate(date: Date): string { return date.toISOString().slice(0, 10) }

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function addAnchorMonths(anchor: Date, months: number): Date {
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(anchor.getUTCDate(), lastDay)))
}

function getPhilippineDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Manila',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function getDueBillingPeriods(anchorDate: string, throughDate: string): BillingPeriod[] {
  const anchor = parseDatabaseDate(anchorDate)
  const through = parseDatabaseDate(throughDate)
  const periods: BillingPeriod[] = []
  for (let offset = 0; offset < 1200; offset += 1) {
    const start = addAnchorMonths(anchor, offset)
    if (start > through) return periods
    const nextStart = addAnchorMonths(anchor, offset + 1)
    periods.push({
      start: toDatabaseDate(start),
      end: toDatabaseDate(addDays(nextStart, -1)),
      dueDate: toDatabaseDate(addDays(start, 14)),
    })
  }
  throw new Error('MONTHLY_BILLING_PERIOD_LIMIT_EXCEEDED')
}

async function sendStatementReadyEmail(userId: string, billingMonth: string): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  const email = data.user?.email
  if (error || !email) {
    console.error('Failed to load statement customer email', { code: error?.code ?? 'EMAIL_NOT_FOUND', userId })
    return false
  }
  const statementsUrl = new URL('/account/statements', env.appUrl).toString()
  const result = await sendEmail({
    to: email,
    subject: `Your ${billingMonth} Statement of Account is ready`,
    text: `Your monthly Statement of Account is ready. Sign in to view or download it: ${statementsUrl}`,
    html: `<p>Your monthly Statement of Account is ready.</p><p><a href="${statementsUrl}">View your statements</a></p>`,
  })
  return result.success
}

export async function runMonthlyBillingJob(now = new Date()): Promise<MonthlyBillingResult> {
  await applyScheduledTerminations(now)
  await applyScheduledPlanChanges(now)
  const philippineDate = getPhilippineDate(now)
  const statementDate = parseDatabaseDate(philippineDate)
  const statementYear = statementDate.getUTCFullYear()
  const statementMonth = statementDate.getUTCMonth() + 1

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('id, user_id, activated_at, billing_anchor_date, plan:plans!inner(price_cents, billing_interval, currency)')
    .eq('status', 'active')
    .eq('plan.billing_interval', 'monthly')
    .not('activated_at', 'is', null)
    .not('billing_anchor_date', 'is', null)
    .lte('billing_anchor_date', philippineDate)
    .returns<BillingSubscription[]>()

  if (subscriptionError) {
    console.error('Failed to load monthly billing subscriptions', { code: subscriptionError.code })
    throw new Error('MONTHLY_BILLING_SUBSCRIPTIONS_FAILED')
  }

  let generatedInvoices = 0
  let skippedInvoices = 0
  let processedStatements = 0
  let sentStatementEmails = 0

  for (const subscription of subscriptions) {
    let amountCents: number
    try { amountCents = calculateMonthlyCharge(subscription.plan) }
    catch {
      console.error('Invalid monthly subscription plan pricing', { subscriptionId: subscription.id })
      throw new Error('MONTHLY_BILLING_PRICE_INVALID')
    }

    for (const period of getDueBillingPeriods(subscription.billing_anchor_date, philippineDate)) {
      const { data: invoice, error } = await supabase.from('invoices').upsert({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        amount_cents: amountCents,
        currency: subscription.plan.currency,
        due_date: period.dueDate,
        status: 'open',
        billing_period_start: period.start,
        billing_period_end: period.end,
      }, {
        onConflict: 'subscription_id,billing_period_start,billing_period_end',
        ignoreDuplicates: true,
      }).select('id').maybeSingle<{ id: string }>()

      if (error) {
        console.error('Failed to generate monthly invoice', { code: error.code, subscriptionId: subscription.id })
        throw new Error('MONTHLY_BILLING_INVOICE_FAILED')
      }
      if (invoice) generatedInvoices += 1
      else skippedInvoices += 1
    }

    const statement = await generateAndStoreStatementOfAccountPdf(subscription.user_id, statementYear, statementMonth)
    if (!statement) continue
    processedStatements += 1

    const claimedAt = new Date().toISOString()
    const { data: claimedStatement, error: claimError } = await supabase
      .from('statements_of_account').update({ email_claimed_at: claimedAt })
      .eq('id', statement.id).is('email_claimed_at', null).select('id')
      .maybeSingle<{ id: string }>()
    if (claimError || !claimedStatement) continue

    const billingMonth = new Intl.DateTimeFormat('en-US', {
      month: 'long', year: 'numeric', timeZone: 'Asia/Manila',
    }).format(now)
    if (await sendStatementReadyEmail(subscription.user_id, billingMonth)) {
      sentStatementEmails += 1
    } else {
      await supabase.from('statements_of_account').update({ email_claimed_at: null })
        .eq('id', statement.id).eq('email_claimed_at', claimedAt)
    }
  }

  return { generatedInvoices, skippedInvoices, processedStatements, sentStatementEmails }
}
