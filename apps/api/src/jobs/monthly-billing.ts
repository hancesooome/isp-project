import { env } from '../config/env.js'
import { sendEmail } from '../lib/email.js'
import { supabase } from '../lib/supabase.js'
import { generateAndStoreStatementOfAccountPdf } from '../services/statement-of-account-storage.js'
import { applyScheduledPlanChanges } from './apply-plan-changes.js'

interface BillingSubscription {
  id: string
  user_id: string
  started_at: string
  plan: {
    price_cents: unknown
    billing_interval: unknown
  }
}

interface MonthlyBillingResult {
  generatedInvoices: number
  skippedInvoices: number
  processedStatements: number
  sentStatementEmails: number
}

export function calculateMonthlyCharge(
  plan: BillingSubscription['plan'],
): number {
  if (plan.billing_interval !== 'monthly') {
    throw new Error('MONTHLY_BILLING_INTERVAL_INVALID')
  }

  if (
    typeof plan.price_cents !== 'number' ||
    !Number.isSafeInteger(plan.price_cents) ||
    plan.price_cents < 0 ||
    plan.price_cents > 2_147_483_647
  ) {
    throw new Error('MONTHLY_BILLING_PRICE_INVALID')
  }

  return plan.price_cents
}

function toDatabaseDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

async function sendStatementReadyEmail(
  userId: string,
  billingMonth: string,
): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  const email = data.user?.email

  if (error || !email) {
    console.error('Failed to load statement customer email', {
      code: error?.code ?? 'EMAIL_NOT_FOUND',
      userId,
    })
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

export async function runMonthlyBillingJob(
  now = new Date(),
): Promise<MonthlyBillingResult> {
  await applyScheduledPlanChanges(now)

  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const periodStart = new Date(Date.UTC(year, month, 1))
  const periodEnd = new Date(Date.UTC(year, month + 1, 0))
  const dueDate = new Date(Date.UTC(year, month, 15))

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select(
      'id, user_id, started_at, plan:plans!inner(price_cents, billing_interval)',
    )
    .eq('status', 'active')
    .eq('plan.billing_interval', 'monthly')
    .lte('started_at', periodStart.toISOString())
    .returns<BillingSubscription[]>()

  if (subscriptionError) {
    console.error('Failed to load monthly billing subscriptions', {
      code: subscriptionError.code,
    })
    throw new Error('MONTHLY_BILLING_SUBSCRIPTIONS_FAILED')
  }

  let generatedInvoices = 0
  let skippedInvoices = 0
  let processedStatements = 0
  let sentStatementEmails = 0

  for (const subscription of subscriptions) {
    let amountCents: number

    try {
      amountCents = calculateMonthlyCharge(subscription.plan)
    } catch {
      console.error('Invalid monthly subscription plan pricing', {
        subscriptionId: subscription.id,
      })
      throw new Error('MONTHLY_BILLING_PRICE_INVALID')
    }

    const { data: invoice, error } = await supabase
      .from('invoices')
      .upsert(
        {
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          amount_cents: amountCents,
          due_date: toDatabaseDate(dueDate),
          status: 'open',
          billing_period_start: toDatabaseDate(periodStart),
          billing_period_end: toDatabaseDate(periodEnd),
        },
        {
          onConflict:
            'subscription_id,billing_period_start,billing_period_end',
          ignoreDuplicates: true,
        },
      )
      .select('id')
      .maybeSingle<{ id: string }>()

    if (error) {
      console.error('Failed to generate monthly invoice', {
        code: error.code,
        subscriptionId: subscription.id,
      })
      throw new Error('MONTHLY_BILLING_INVOICE_FAILED')
    }

    if (invoice) {
      generatedInvoices += 1
    } else {
      skippedInvoices += 1
    }

    const statement = await generateAndStoreStatementOfAccountPdf(
      subscription.user_id,
      year,
      month + 1,
    )

    if (!statement) {
      console.error('Monthly statement customer was not found', {
        userId: subscription.user_id,
      })
      continue
    }

    processedStatements += 1

    const claimedAt = new Date().toISOString()
    const { data: claimedStatement, error: claimError } = await supabase
      .from('statements_of_account')
      .update({ email_claimed_at: claimedAt })
      .eq('id', statement.id)
      .is('email_claimed_at', null)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (claimError) {
      console.error('Failed to claim monthly statement email', {
        code: claimError.code,
        statementId: statement.id,
      })
      continue
    }

    if (!claimedStatement) {
      continue
    }

    const billingMonth = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(periodStart)
    const sent = await sendStatementReadyEmail(
      subscription.user_id,
      billingMonth,
    )

    if (sent) {
      sentStatementEmails += 1
      continue
    }

    const { error: releaseError } = await supabase
      .from('statements_of_account')
      .update({ email_claimed_at: null })
      .eq('id', statement.id)
      .eq('email_claimed_at', claimedAt)

    console.error('Failed to send monthly statement email', {
      releaseFailed: Boolean(releaseError),
      statementId: statement.id,
    })
  }

  return {
    generatedInvoices,
    skippedInvoices,
    processedStatements,
    sentStatementEmails,
  }
}
