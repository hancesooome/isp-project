import { supabase } from '../lib/supabase.js'

interface StatementInvoice {
  id: string
  amount_cents: number
  due_date: string
  status: 'open' | 'paid' | 'overdue'
  billing_period_start: string
  billing_period_end: string
}

interface StatementPayment {
  id: string
  invoice_id: string
  amount_cents: number
  paid_at: string
}

export interface StatementOfAccount {
  generated_at: string
  customer: {
    id: string
    email: string
    full_name: string | null
    phone: string | null
    address: string | null
    installation_address: string | null
  }
  subscription: {
    id: string
    status: 'active' | 'past_due' | 'canceled'
    started_at: string
    ended_at: string | null
    plan: {
      name: string
      billing_interval: 'monthly' | 'yearly'
    }
  } | null
  invoices: StatementInvoice[]
  payments: StatementPayment[]
  totals: {
    invoiced_cents: number
    paid_cents: number
    balance_cents: number
  }
}

interface ProfileRecord {
  id: string
  full_name: string | null
}

interface CustomerProfileRecord {
  phone: string | null
  address: string | null
  installation_address: string | null
}

type SubscriptionRecord = NonNullable<StatementOfAccount['subscription']>

function calculateTotals(
  invoices: StatementInvoice[],
  payments: StatementPayment[],
): StatementOfAccount['totals'] {
  const invoicedCents = invoices.reduce(
    (total, invoice) => total + invoice.amount_cents,
    0,
  )
  const paidCents = payments.reduce(
    (total, payment) => total + payment.amount_cents,
    0,
  )

  if (!Number.isSafeInteger(invoicedCents) || !Number.isSafeInteger(paidCents)) {
    throw new Error('STATEMENT_TOTAL_OUT_OF_RANGE')
  }

  return {
    invoiced_cents: invoicedCents,
    paid_cents: paidCents,
    balance_cents: invoicedCents - paidCents,
  }
}

export async function generateStatementOfAccount(
  userId: string,
): Promise<StatementOfAccount | null> {
  const [
    authResult,
    profileResult,
    customerProfileResult,
    subscriptionResult,
    invoiceResult,
    paymentResult,
  ] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .maybeSingle<ProfileRecord>(),
    supabase
      .from('customer_profiles')
      .select('phone, address, installation_address')
      .eq('user_id', userId)
      .maybeSingle<CustomerProfileRecord>(),
    supabase
      .from('subscriptions')
      .select(
        'id, status, started_at, ended_at, plan:plans(name, billing_interval)',
      )
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRecord>(),
    supabase
      .from('invoices')
      .select(
        'id, amount_cents, due_date, status, billing_period_start, billing_period_end',
      )
      .eq('user_id', userId)
      .order('billing_period_start', { ascending: true })
      .order('id')
      .returns<StatementInvoice[]>(),
    supabase
      .from('payments')
      .select('id, invoice_id, amount_cents, paid_at')
      .eq('user_id', userId)
      .eq('status', 'succeeded')
      .order('paid_at', { ascending: true })
      .order('id')
      .returns<StatementPayment[]>(),
  ])

  const error =
    authResult.error ??
    profileResult.error ??
    customerProfileResult.error ??
    subscriptionResult.error ??
    invoiceResult.error ??
    paymentResult.error

  if (error) {
    console.error('Failed to generate statement of account data', {
      code: error.code,
      userId,
    })
    throw new Error('STATEMENT_DATA_FAILED')
  }

  const email = authResult.data.user?.email
  const profile = profileResult.data

  if (!email || !profile) {
    return null
  }

  const customerProfile = customerProfileResult.data
  const invoices = invoiceResult.data ?? []
  const payments = paymentResult.data ?? []

  return {
    generated_at: new Date().toISOString(),
    customer: {
      id: profile.id,
      email,
      full_name: profile.full_name,
      phone: customerProfile?.phone ?? null,
      address: customerProfile?.address ?? null,
      installation_address: customerProfile?.installation_address ?? null,
    },
    subscription: subscriptionResult.data,
    invoices,
    payments,
    totals: calculateTotals(invoices, payments),
  }
}
