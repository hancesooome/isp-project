import { supabase } from '../lib/supabase.js'

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

export async function runMonthlyBillingJob(
  now = new Date(),
): Promise<MonthlyBillingResult> {
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
  }

  return { generatedInvoices, skippedInvoices }
}
