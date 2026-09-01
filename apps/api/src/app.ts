import express from 'express'
import { z } from 'zod'

import { env } from './config/env.js'
import { runMonthlyBillingJob } from './jobs/monthly-billing.js'
import { runOverdueInvoiceJob } from './jobs/overdue-invoices.js'
import { runUpcomingDueReminderJob } from './jobs/upcoming-due-reminders.js'
import { sendEmail } from './lib/email.js'
import { supabase } from './lib/supabase.js'
import { stripe } from './lib/stripe.js'
import { statementOfAccountStorage } from './services/statement-of-account-storage.js'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
}

interface AdminPlan extends Plan {
  speed_mbps: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type UserRole = 'customer' | 'admin'

interface AuthorizationResult {
  status: 200 | 401 | 403 | 500
  userId?: string
}

interface CustomerApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  rejection_reason: string | null
  plan: { name: string } | null
}

interface CustomerSubscription {
  id: string
  status: 'active' | 'past_due'
  started_at: string
  plan: {
    id: string
    name: string
    description: string | null
    price_cents: number
    billing_interval: 'monthly' | 'yearly'
  } | null
}

interface CustomerInvoice {
  id: string
  amount_cents: number
  due_date: string
  status: 'open' | 'paid' | 'overdue'
  billing_period_start: string
  billing_period_end: string
  created_at: string
}

interface CustomerStatementReference {
  id: string
  billing_period_start: string
  storage_key: string
}

interface CustomerStatement {
  id: string
  billing_period_start: string
  billing_period_end: string
  created_at: string
}

interface CustomerSupportTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
  updated_at: string
  resolved_at: string | null
}

interface SupportTicketResponse {
  id: string
  body: string
  created_at: string
  author: { full_name: string | null } | null
}

interface AdminApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  installation_address: string
  submitted_at: string
  rejection_reason: string | null
  customer: { id: string; full_name: string | null } | null
  plan: { id: string; name: string } | null
}

interface AdminApplicationDetail {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  installation_address: string
  submitted_at: string
  reviewed_at: string | null
  rejection_reason: string | null
  customer: {
    id: string
    full_name: string | null
    customer_profile: {
      phone: string | null
      address: string | null
    } | null
  } | null
  plan: {
    id: string
    name: string
    description: string | null
    billing_interval: 'monthly' | 'yearly'
  } | null
}

interface AdminSubscription {
  id: string
  status: 'active' | 'past_due' | 'canceled'
  started_at: string
  ended_at: string | null
  customer: { id: string; full_name: string | null } | null
  plan: { id: string; name: string } | null
}

interface AdminSubscriptionDetail extends AdminSubscription {
  created_at: string
  updated_at: string
  customer: {
    id: string
    full_name: string | null
    customer_profile: {
      phone: string | null
      address: string | null
      installation_address: string | null
    } | null
  } | null
  plan: {
    id: string
    name: string
    slug: string
    speed_mbps: number | null
    price_cents: number
    billing_interval: 'monthly' | 'yearly'
    is_active: boolean
  } | null
  application: {
    id: string
    status: 'pending' | 'approved' | 'rejected'
    submitted_at: string
    installation_address: string
  } | null
}

interface AdminCustomerSummary {
  id: string
  full_name: string | null
  customer_profile: { phone: string | null } | null
}

interface AdminCustomerProfile extends AdminCustomerSummary {
  customer_profile: {
    phone: string | null
    address: string | null
    installation_address: string | null
  } | null
}

interface AdminCustomerApplication {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  installation_address: string
  submitted_at: string
  reviewed_at: string | null
  plan: { name: string } | null
}

interface AdminCustomerSubscription {
  id: string
  status: 'active' | 'past_due' | 'canceled'
  started_at: string
  ended_at: string | null
  plan: {
    name: string
    price_cents: number
    billing_interval: 'monthly' | 'yearly'
  } | null
}

interface AdminCustomerInvoiceSummaryRow {
  amount_cents: number
  due_date: string
  status: 'open' | 'paid' | 'overdue'
}

interface AdminSupportTicketSummary {
  id: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at: string
  updated_at: string
  customer: { full_name: string | null } | null
}

interface AdminSupportTicketDetail extends AdminSupportTicketSummary {
  description: string
  resolved_at: string | null
}

const availabilitySchema = z.object({
  address: z.string().trim().min(5).max(250),
})

const applicationSchema = z
  .object({
    plan_id: z.string().uuid(),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(30)
      .regex(/^[0-9+() -]+$/),
    address: z.string().trim().min(5).max(250),
    installation_address: z.string().trim().min(5).max(250),
  })
  .strict()

const adminApplicationsQuerySchema = z
  .object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
  })
  .strict()

const applicationIdSchema = z.string().uuid()
const customerIdSchema = z.string().uuid()
const invoiceIdSchema = z.string().uuid()
const planIdSchema = z.string().uuid()
const statementIdSchema = z.string().uuid()
const subscriptionIdSchema = z.string().uuid()
const supportTicketIdSchema = z.string().uuid()

const supportTicketSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    description: z.string().trim().min(10).max(5000),
  })
  .strict()

const supportTicketResponseSchema = z
  .object({
    body: z.string().trim().min(1).max(5000),
  })
  .strict()

const adminSupportTicketStatusSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  })
  .strict()

const databaseDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDatabaseDate)

const adminInvoiceSchema = z
  .object({
    subscription_id: z.string().uuid(),
    amount_cents: z.number().int().min(0).max(2_147_483_647),
    due_date: databaseDateSchema,
    billing_period_start: databaseDateSchema,
    billing_period_end: databaseDateSchema,
  })
  .strict()
  .refine(
    (invoice) => invoice.billing_period_end > invoice.billing_period_start,
    { path: ['billing_period_end'] },
  )

const adminInvoiceStatusSchema = z
  .object({
    status: z.literal('overdue'),
  })
  .strict()

const adminPlanSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(1000).nullable(),
    speed_mbps: z.number().int().min(1).max(100_000),
    price_cents: z.number().int().min(0).max(2_147_483_647),
    billing_interval: z.enum(['monthly', 'yearly']),
  })
  .strict()

const adminPlanActivationSchema = z
  .object({
    is_active: z.boolean(),
  })
  .strict()

const adminSubscriptionsQuerySchema = z
  .object({
    status: z.enum(['active', 'past_due', 'canceled', 'all']).optional(),
  })
  .strict()

const adminSubscriptionStatusSchema = z
  .object({
    status: z.enum(['active', 'past_due', 'canceled']),
  })
  .strict()

const adminPlanSelect =
  'id, name, slug, description, speed_mbps, price_cents, billing_interval, is_active, created_at, updated_at'

const applicationReviewSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('approved') }).strict(),
  z
    .object({
      status: z.literal('rejected'),
      rejection_reason: z.string().trim().min(3).max(500),
    })
    .strict(),
])

function isServiceAvailable(address: string): boolean {
  const normalizedAddress = address.toLowerCase()
  return env.serviceAreaKeywords.some((area) =>
    normalizedAddress.includes(area),
  )
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function sendApplicationStatusEmail(
  userId: string,
  status: 'approved' | 'rejected',
  rejectionReason: string | null,
): Promise<void> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  const email = data.user?.email

  if (error || !email) {
    console.error('Failed to load application customer email', {
      code: error?.code ?? 'EMAIL_NOT_FOUND',
      userId,
    })
    return
  }

  const isApproved = status === 'approved'
  const reasonText =
    !isApproved && rejectionReason
      ? `\n\nReason: ${rejectionReason}`
      : ''
  const reasonHtml =
    !isApproved && rejectionReason
      ? `<p><strong>Reason:</strong> ${escapeHtml(rejectionReason)}</p>`
      : ''

  await sendEmail({
    to: email,
    subject: isApproved
      ? 'Your service application was approved'
      : 'Update on your service application',
    text: isApproved
      ? 'Your ISP service application has been approved.'
      : `Your ISP service application was not approved.${reasonText}`,
    html: isApproved
      ? '<p>Your ISP service application has been approved.</p>'
      : `<p>Your ISP service application was not approved.</p>${reasonHtml}`,
  })
}

async function sendPaymentReceiptEmail(
  userId: string,
  invoiceId: string,
  amountCents: number,
  paidAt: string,
): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  const email = data.user?.email

  if (error || !email) {
    console.error('Failed to load payment customer email', {
      code: error?.code ?? 'EMAIL_NOT_FOUND',
      userId,
    })
    return false
  }

  const invoiceReference = invoiceId.slice(0, 8).toUpperCase()
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: env.stripeCurrency.toUpperCase(),
  }).format(amountCents / 100)
  const paymentDate = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(paidAt))

  const result = await sendEmail({
    to: email,
    subject: `Payment receipt for invoice #${invoiceReference}`,
    text: `We received your payment.\n\nInvoice: #${invoiceReference}\nAmount paid: ${amount}\nPayment date: ${paymentDate}`,
    html: `<p>We received your payment.</p><p><strong>Invoice:</strong> #${invoiceReference}<br><strong>Amount paid:</strong> ${amount}<br><strong>Payment date:</strong> ${paymentDate}</p>`,
  })

  return result.success
}

function isValidDatabaseDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

async function authorizeRole(
  authorizationHeader: string | undefined,
  requiredRole: UserRole,
): Promise<AuthorizationResult> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return { status: 401 }
  }

  const token = authorizationHeader.slice('Bearer '.length).trim()

  if (!token) {
    return { status: 401 }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return { status: 401 }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>()

  if (profileError) {
    console.error('Failed to verify user role', {
      code: profileError.code,
    })
    return { status: 500 }
  }

  if (profile?.role !== requiredRole) {
    return { status: 403 }
  }

  return { status: 200, userId: user.id }
}

export const app = express()

app.disable('x-powered-by')

app.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (request, response) => {
    const signature = request.header('stripe-signature')

    if (!signature || !Buffer.isBuffer(request.body)) {
      response.status(400).json({ error: 'Invalid webhook signature' })
      return
    }

    let event

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        signature,
        env.stripeWebhookSecret,
      )
    } catch {
      response.status(400).json({ error: 'Invalid webhook signature' })
      return
    }

    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.async_payment_succeeded' &&
      event.type !== 'checkout.session.async_payment_failed'
    ) {
      response.status(200).json({ received: true })
      return
    }

    const checkoutSession = event.data.object

    const isFailedPayment =
      event.type === 'checkout.session.async_payment_failed'

    if (checkoutSession.mode !== 'payment') {
      response.status(200).json({ received: true })
      return
    }

    if (!isFailedPayment && checkoutSession.payment_status !== 'paid') {
      response.status(200).json({ received: true })
      return
    }

    const invoiceIdResult = invoiceIdSchema.safeParse(
      checkoutSession.metadata?.invoice_id,
    )
    const paymentIntentReference =
      typeof checkoutSession.payment_intent === 'string'
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id

    if (
      !invoiceIdResult.success ||
      checkoutSession.client_reference_id !== invoiceIdResult.data ||
      !paymentIntentReference
    ) {
      console.warn('Ignored Stripe Checkout Session with invalid references', {
        eventId: event.id,
      })
      response.status(200).json({ received: true })
      return
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, user_id, amount_cents')
      .eq('id', invoiceIdResult.data)
      .maybeSingle<{
        id: string
        user_id: string
        amount_cents: number
      }>()

    if (invoiceError) {
      console.error('Failed to reconcile Stripe payment invoice', {
        code: invoiceError.code,
        eventId: event.id,
      })
      response.status(500).json({ error: 'Unable to process webhook' })
      return
    }

    if (
      !invoice ||
      checkoutSession.amount_total !== invoice.amount_cents ||
      checkoutSession.currency !== env.stripeCurrency
    ) {
      console.warn('Ignored Stripe payment that did not match its invoice', {
        eventId: event.id,
      })
      response.status(200).json({ received: true })
      return
    }

    const paidAt = new Date(event.created * 1000).toISOString()
    const { error: paymentError } = isFailedPayment
      ? await supabase.rpc('record_failed_stripe_payment', {
          p_invoice_id: invoice.id,
          p_provider_reference: paymentIntentReference,
          p_amount_cents: invoice.amount_cents,
        })
      : await supabase.rpc('record_stripe_payment', {
          p_invoice_id: invoice.id,
          p_provider_reference: paymentIntentReference,
          p_amount_cents: invoice.amount_cents,
          p_paid_at: paidAt,
        })

    if (paymentError) {
      console.error('Failed to reconcile Stripe payment', {
        code: paymentError.code,
        eventId: event.id,
      })
      response.status(500).json({ error: 'Unable to process webhook' })
      return
    }

    if (!isFailedPayment) {
      const { data: shouldSendReceipt, error: receiptClaimError } =
        await supabase.rpc('claim_stripe_payment_receipt', {
          p_provider_reference: paymentIntentReference,
        })

      if (receiptClaimError) {
        console.error('Failed to claim payment receipt email', {
          code: receiptClaimError.code,
          eventId: event.id,
        })
      } else if (shouldSendReceipt) {
        const sent = await sendPaymentReceiptEmail(
          invoice.user_id,
          invoice.id,
          invoice.amount_cents,
          paidAt,
        )

        if (!sent) {
          const { error: resetError } = await supabase
            .from('payments')
            .update({ receipt_email_claimed_at: null })
            .eq('provider', 'stripe')
            .eq('provider_reference', paymentIntentReference)
            .eq('status', 'succeeded')

          if (resetError) {
            console.error('Failed to release payment receipt email claim', {
              code: resetError.code,
              eventId: event.id,
            })
          }
        }
      }
    }

    response.status(200).json({ received: true })
  },
)

app.use(express.json({ limit: '10kb' }))

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' })
})

app.get('/jobs/monthly-billing', async (request, response) => {
  if (request.header('authorization') !== `Bearer ${env.cronSecret}`) {
    response.status(401).json({ error: 'Unauthorized' })
    return
  }

  console.info('Monthly billing job started')

  try {
    const result = await runMonthlyBillingJob()

    console.info('Monthly billing job completed', {
      generatedInvoices: result.generatedInvoices,
      processedStatements: result.processedStatements,
      sentStatementEmails: result.sentStatementEmails,
    })
    response.status(200).json({ success: true, ...result })
  } catch {
    console.error('Monthly billing job failed')
    response.status(500).json({ error: 'Unable to run monthly billing job' })
  }
})

app.get('/jobs/upcoming-due-reminders', async (request, response) => {
  if (request.header('authorization') !== `Bearer ${env.cronSecret}`) {
    response.status(401).json({ error: 'Unauthorized' })
    return
  }

  console.info('Upcoming-due reminder job started')

  try {
    const result = await runUpcomingDueReminderJob()

    console.info('Upcoming-due reminder job completed', result)
    response.status(200).json({ success: true, ...result })
  } catch {
    console.error('Upcoming-due reminder job failed')
    response.status(500).json({ error: 'Unable to run upcoming-due reminders' })
  }
})

app.get('/jobs/overdue-invoices', async (request, response) => {
  if (request.header('authorization') !== `Bearer ${env.cronSecret}`) {
    response.status(401).json({ error: 'Unauthorized' })
    return
  }

  console.info('Overdue invoice job started')

  try {
    const result = await runOverdueInvoiceJob()

    console.info('Overdue invoice job completed', result)
    response.status(200).json({ success: true, ...result })
  } catch {
    console.error('Overdue invoice job failed')
    response.status(500).json({ error: 'Unable to mark overdue invoices' })
  }
})

app.get('/plans', async (_request, response) => {
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, slug, description, price_cents, billing_interval')
    .eq('is_active', true)
    .order('price_cents')
    .order('name')
    .order('id')
    .returns<Plan[]>()

  if (error) {
    console.error('Failed to load plans', { code: error.code })
    response.status(500).json({ error: 'Unable to load plans' })
    return
  }

  response.status(200).json({ plans: data })
})

app.post('/service-availability', (request, response) => {
  const result = availabilitySchema.safeParse(request.body)

  if (!result.success) {
    response.status(400).json({ error: 'Enter a valid service address' })
    return
  }

  response.status(200).json({
    available: isServiceAvailable(result.data.address),
  })
})

app.post('/applications', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to submit application' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const result = applicationSchema.safeParse(request.body)

  if (!result.success) {
    response.status(400).json({ error: 'Enter valid application details' })
    return
  }

  if (!isServiceAvailable(result.data.installation_address)) {
    response.status(422).json({ error: 'Service is unavailable at this address' })
    return
  }

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('id')
    .eq('id', result.data.plan_id)
    .eq('is_active', true)
    .maybeSingle<{ id: string }>()

  if (planError) {
    console.error('Failed to verify application plan', { code: planError.code })
    response.status(500).json({ error: 'Unable to submit application' })
    return
  }

  if (!plan) {
    response.status(400).json({ error: 'Select an available plan' })
    return
  }

  const { data: pendingApplication, error: duplicateCheckError } = await supabase
    .from('applications')
    .select('id')
    .eq('user_id', auth.userId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (duplicateCheckError) {
    console.error('Failed to check pending applications', {
      code: duplicateCheckError.code,
    })
    response.status(500).json({ error: 'Unable to submit application' })
    return
  }

  if (pendingApplication) {
    response.status(409).json({ error: 'A pending application already exists' })
    return
  }

  const updatedAt = new Date().toISOString()
  const { error: customerProfileError } = await supabase
    .from('customer_profiles')
    .upsert(
      {
        user_id: auth.userId,
        phone: result.data.phone,
        address: result.data.address,
        installation_address: result.data.installation_address,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' },
    )

  if (customerProfileError) {
    console.error('Failed to save customer profile', {
      code: customerProfileError.code,
    })
    response.status(500).json({ error: 'Unable to submit application' })
    return
  }

  const { data: application, error: applicationError } = await supabase
    .from('applications')
    .insert({
      user_id: auth.userId,
      plan_id: result.data.plan_id,
      installation_address: result.data.installation_address,
      status: 'pending',
    })
    .select('id, status, submitted_at')
    .single<{ id: string; status: 'pending'; submitted_at: string }>()

  if (applicationError) {
    if (applicationError.code === '23505') {
      response.status(409).json({ error: 'A pending application already exists' })
      return
    }

    console.error('Failed to create application', {
      code: applicationError.code,
    })
    response.status(500).json({ error: 'Unable to submit application' })
    return
  }

  response.status(201).json({ application })
})

app.get('/applications/current', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load application' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const { data: application, error } = await supabase
    .from('applications')
    .select(
      'id, status, submitted_at, rejection_reason, plan:plans(name)',
    )
    .eq('user_id', auth.userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle<CustomerApplication>()

  if (error) {
    console.error('Failed to load customer application', { code: error.code })
    response.status(500).json({ error: 'Unable to load application' })
    return
  }

  response.status(200).json({ application })
})

app.post('/support-tickets', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to create support ticket' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const result = supportTicketSchema.safeParse(request.body)

  if (!result.success) {
    response.status(400).json({ error: 'Enter valid support ticket details' })
    return
  }

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: auth.userId,
      subject: result.data.subject,
      description: result.data.description,
    })
    .select(
      'id, subject, description, status, created_at, updated_at, resolved_at',
    )
    .single<CustomerSupportTicket>()

  if (error) {
    console.error('Failed to create customer support ticket', {
      code: error.code,
    })
    response.status(500).json({ error: 'Unable to create support ticket' })
    return
  }

  response.status(201).json({ ticket })
})

app.get('/support-tickets', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load support tickets' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const { data: tickets, error } = await supabase
    .from('support_tickets')
    .select(
      'id, subject, description, status, created_at, updated_at, resolved_at',
    )
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .returns<CustomerSupportTicket[]>()

  if (error) {
    console.error('Failed to load customer support tickets', {
      code: error.code,
    })
    response.status(500).json({ error: 'Unable to load support tickets' })
    return
  }

  response.status(200).json({ tickets })
})

app.get('/support-tickets/:id', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load support ticket' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = supportTicketIdSchema.safeParse(request.params.id)

  if (!idResult.success) {
    response.status(400).json({ error: 'Invalid support ticket ID' })
    return
  }

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .select(
      'id, subject, description, status, created_at, updated_at, resolved_at',
    )
    .eq('id', idResult.data)
    .eq('user_id', auth.userId)
    .maybeSingle<CustomerSupportTicket>()

  if (error) {
    console.error('Failed to load customer support ticket', {
      code: error.code,
    })
    response.status(500).json({ error: 'Unable to load support ticket' })
    return
  }

  if (!ticket) {
    response.status(404).json({ error: 'Support ticket not found' })
    return
  }

  const { data: responses, error: responsesError } = await supabase
    .from('support_ticket_responses')
    .select(
      `
        id,
        body,
        created_at,
        author:profiles!support_ticket_responses_admin_id_fkey(full_name)
      `,
    )
    .eq('ticket_id', ticket.id)
    .order('created_at')
    .order('id')
    .returns<SupportTicketResponse[]>()

  if (responsesError) {
    console.error('Failed to load customer support ticket responses', {
      code: responsesError.code,
      ticketId: ticket.id,
    })
    response.status(500).json({ error: 'Unable to load support ticket' })
    return
  }

  response.status(200).json({ ticket: { ...ticket, responses } })
})

app.get('/subscription', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load subscription' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select(
      `
        id,
        status,
        started_at,
        plan:plans(id, name, description, price_cents, billing_interval)
      `,
    )
    .eq('user_id', auth.userId)
    .in('status', ['active', 'past_due'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle<CustomerSubscription>()

  if (error) {
    console.error('Failed to load customer subscription', { code: error.code })
    response.status(500).json({ error: 'Unable to load subscription' })
    return
  }

  response.status(200).json({ subscription })
})

app.get('/invoices', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load invoices' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(
      `
        id,
        amount_cents,
        due_date,
        status,
        billing_period_start,
        billing_period_end,
        created_at
      `,
    )
    .eq('user_id', auth.userId)
    .order('billing_period_start', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .returns<CustomerInvoice[]>()

  if (error) {
    console.error('Failed to load customer invoices', { code: error.code })
    response.status(500).json({ error: 'Unable to load invoices' })
    return
  }

  response.status(200).json({ invoices })
})

app.get('/invoices/:id', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load invoice' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = invoiceIdSchema.safeParse(request.params.id)

  if (!idResult.success) {
    response.status(400).json({ error: 'Invalid invoice ID' })
    return
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(
      `
        id,
        amount_cents,
        due_date,
        status,
        billing_period_start,
        billing_period_end,
        created_at
      `,
    )
    .eq('id', idResult.data)
    .eq('user_id', auth.userId)
    .maybeSingle<CustomerInvoice>()

  if (error) {
    console.error('Failed to load customer invoice', { code: error.code })
    response.status(500).json({ error: 'Unable to load invoice' })
    return
  }

  if (!invoice) {
    response.status(404).json({ error: 'Invoice not found' })
    return
  }

  response.status(200).json({ invoice })
})

app.get('/statements', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load statements' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const { data: statements, error } = await supabase
    .from('statements_of_account')
    .select('id, billing_period_start, billing_period_end, created_at')
    .eq('user_id', auth.userId)
    .order('billing_period_start', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .returns<CustomerStatement[]>()

  if (error) {
    console.error('Failed to load customer statements', { code: error.code })
    response.status(500).json({ error: 'Unable to load statements' })
    return
  }

  response.status(200).json({ statements })
})

app.get('/statements/:id/download', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to download statement' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = statementIdSchema.safeParse(request.params.id)

  if (!idResult.success) {
    response.status(400).json({ error: 'Invalid statement ID' })
    return
  }

  const { data: statement, error } = await supabase
    .from('statements_of_account')
    .select('id, billing_period_start, storage_key')
    .eq('id', idResult.data)
    .eq('user_id', auth.userId)
    .maybeSingle<CustomerStatementReference>()

  if (error) {
    console.error('Failed to load customer statement reference', {
      code: error.code,
    })
    response.status(500).json({ error: 'Unable to download statement' })
    return
  }

  if (!statement) {
    response.status(404).json({ error: 'Statement not found' })
    return
  }

  const { data: file, error: downloadError } =
    await statementOfAccountStorage.download(statement.storage_key)

  if (downloadError || !file) {
    console.error('Failed to download statement of account PDF', {
      statusCode: downloadError?.statusCode,
      statementId: statement.id,
    })

    if (String(downloadError?.statusCode) === '404') {
      response.status(404).json({ error: 'Statement file not found' })
      return
    }

    response.status(500).json({ error: 'Unable to download statement' })
    return
  }

  const billingMonth = statement.billing_period_start.slice(0, 7)
  const pdf = Buffer.from(await file.arrayBuffer())

  response
    .status(200)
    .set({
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        `attachment; filename="statement-of-account-${billingMonth}.pdf"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'private, no-store',
    })
    .send(pdf)
})

app.post('/invoices/:id/checkout-session', async (request, response) => {
  const auth = await authorizeRole(
    request.header('authorization'),
    'customer',
  )

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to start checkout' })
      return
    }

    const message =
      auth.status === 403 ? 'Customer access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = invoiceIdSchema.safeParse(request.params.id)

  if (!idResult.success) {
    response.status(400).json({ error: 'Invalid invoice ID' })
    return
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, amount_cents, status')
    .eq('id', idResult.data)
    .eq('user_id', auth.userId)
    .maybeSingle<{
      id: string
      amount_cents: number
      status: 'open' | 'paid' | 'overdue'
    }>()

  if (error) {
    console.error('Failed to load checkout invoice', { code: error.code })
    response.status(500).json({ error: 'Unable to start checkout' })
    return
  }

  if (!invoice) {
    response.status(404).json({ error: 'Invoice not found' })
    return
  }

  if (invoice.status !== 'open' || invoice.amount_cents <= 0) {
    response.status(409).json({ error: 'Invoice is not eligible for payment' })
    return
  }

  const invoicePath = `/account/invoices/${encodeURIComponent(invoice.id)}`
  const successUrl = new URL(invoicePath, env.appUrl)
  successUrl.searchParams.set('checkout', 'success')
  const cancelUrl = new URL(invoicePath, env.appUrl)
  cancelUrl.searchParams.set('checkout', 'canceled')

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      client_reference_id: invoice.id,
      metadata: {
        invoice_id: invoice.id,
      },
      payment_intent_data: {
        metadata: {
          invoice_id: invoice.id,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: env.stripeCurrency,
            unit_amount: invoice.amount_cents,
            product_data: {
              name: `ISP invoice #${invoice.id.slice(0, 8).toUpperCase()}`,
            },
          },
        },
      ],
    })

    if (!session.url) {
      console.error('Stripe Checkout Session did not include a URL')
      response.status(500).json({ error: 'Unable to start checkout' })
      return
    }

    response.status(201).json({ checkout_url: session.url })
  } catch {
    console.error('Failed to create Stripe Checkout Session')
    response.status(502).json({ error: 'Unable to start checkout' })
  }
})

app.get('/admin/access', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to verify admin access' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  response.status(200).json({ authorized: true })
})

app.get('/admin/plans', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load plans' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const { data: plans, error } = await supabase
    .from('plans')
    .select(adminPlanSelect)
    .order('is_active', { ascending: false })
    .order('price_cents')
    .order('name')
    .order('id')
    .returns<AdminPlan[]>()

  if (error) {
    console.error('Failed to load admin plans', { code: error.code })
    response.status(500).json({ error: 'Unable to load plans' })
    return
  }

  response.status(200).json({ plans })
})

app.post('/admin/plans', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to create plan' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const result = adminPlanSchema.safeParse(request.body)

  if (!result.success) {
    response.status(400).json({ error: 'Enter valid plan details' })
    return
  }

  const { data: plan, error } = await supabase
    .from('plans')
    .insert({
      ...result.data,
      description: result.data.description || null,
    })
    .select(adminPlanSelect)
    .single<AdminPlan>()

  if (error) {
    if (error.code === '23505') {
      response.status(409).json({ error: 'A plan with this slug already exists' })
      return
    }

    console.error('Failed to create admin plan', { code: error.code })
    response.status(500).json({ error: 'Unable to create plan' })
    return
  }

  response.status(201).json({ plan })
})

app.patch('/admin/plans/:id', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to update plan' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = planIdSchema.safeParse(request.params.id)
  const planResult = adminPlanSchema.safeParse(request.body)

  if (!idResult.success || !planResult.success) {
    response.status(400).json({ error: 'Enter valid plan details' })
    return
  }

  const { data: plan, error } = await supabase
    .from('plans')
    .update({
      ...planResult.data,
      description: planResult.data.description || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
    .select(adminPlanSelect)
    .maybeSingle<AdminPlan>()

  if (error) {
    if (error.code === '23505') {
      response.status(409).json({ error: 'A plan with this slug already exists' })
      return
    }

    console.error('Failed to update admin plan', { code: error.code })
    response.status(500).json({ error: 'Unable to update plan' })
    return
  }

  if (!plan) {
    response.status(404).json({ error: 'Plan not found' })
    return
  }

  response.status(200).json({ plan })
})

app.patch('/admin/plans/:id/activation', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to update plan availability' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = planIdSchema.safeParse(request.params.id)
  const activationResult = adminPlanActivationSchema.safeParse(request.body)

  if (!idResult.success || !activationResult.success) {
    response.status(400).json({ error: 'Enter a valid plan availability' })
    return
  }

  const { data: plan, error } = await supabase
    .from('plans')
    .update({
      is_active: activationResult.data.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', idResult.data)
    .select(adminPlanSelect)
    .maybeSingle<AdminPlan>()

  if (error) {
    console.error('Failed to update admin plan availability', {
      code: error.code,
    })
    response.status(500).json({ error: 'Unable to update plan availability' })
    return
  }

  if (!plan) {
    response.status(404).json({ error: 'Plan not found' })
    return
  }

  response.status(200).json({ plan })
})

app.get('/admin/customers', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load customers' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const { data: customers, error } = await supabase
    .from('profiles')
    .select(
      `
        id,
        full_name,
        customer_profile:customer_profiles(phone)
      `,
    )
    .eq('role', 'customer')
    .order('full_name')
    .order('id')
    .returns<AdminCustomerSummary[]>()

  if (error) {
    console.error('Failed to load admin customers', { code: error.code })
    response.status(500).json({ error: 'Unable to load customers' })
    return
  }

  response.status(200).json({ customers })
})

app.get('/admin/customers/:id', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load customer' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = customerIdSchema.safeParse(request.params.id)

  if (!idResult.success) {
    response.status(400).json({ error: 'Invalid customer ID' })
    return
  }

  const customerId = idResult.data
  const { data: customer, error: customerError } = await supabase
    .from('profiles')
    .select(
      `
        id,
        full_name,
        customer_profile:customer_profiles(phone, address, installation_address)
      `,
    )
    .eq('id', customerId)
    .eq('role', 'customer')
    .maybeSingle<AdminCustomerProfile>()

  if (customerError) {
    console.error('Failed to load admin customer', { code: customerError.code })
    response.status(500).json({ error: 'Unable to load customer' })
    return
  }

  if (!customer) {
    response.status(404).json({ error: 'Customer not found' })
    return
  }

  const [authResult, applicationsResult, subscriptionsResult, invoicesResult] =
    await Promise.all([
      supabase.auth.admin.getUserById(customerId),
      supabase
        .from('applications')
        .select(
          'id, status, installation_address, submitted_at, reviewed_at, plan:plans(name)',
        )
        .eq('user_id', customerId)
        .order('submitted_at', { ascending: false })
        .order('id')
        .returns<AdminCustomerApplication[]>(),
      supabase
        .from('subscriptions')
        .select(
          'id, status, started_at, ended_at, plan:plans(name, price_cents, billing_interval)',
        )
        .eq('user_id', customerId)
        .order('started_at', { ascending: false })
        .order('id')
        .returns<AdminCustomerSubscription[]>(),
      supabase
        .from('invoices')
        .select('amount_cents, due_date, status')
        .eq('user_id', customerId)
        .returns<AdminCustomerInvoiceSummaryRow[]>(),
    ])

  if (
    authResult.error ||
    applicationsResult.error ||
    subscriptionsResult.error ||
    invoicesResult.error
  ) {
    console.error('Failed to load admin customer account information', {
      authError: authResult.error?.name,
      applicationsCode: applicationsResult.error?.code,
      subscriptionsCode: subscriptionsResult.error?.code,
      invoicesCode: invoicesResult.error?.code,
      customerId,
    })
    response.status(500).json({ error: 'Unable to load customer' })
    return
  }

  const outstandingInvoices = invoicesResult.data.filter(
    (invoice) => invoice.status === 'open' || invoice.status === 'overdue',
  )
  const nextDueDate =
    outstandingInvoices.map((invoice) => invoice.due_date).sort()[0] ?? null

  response.status(200).json({
    customer: {
      ...customer,
      email: authResult.data.user.email ?? null,
      applications: applicationsResult.data,
      subscriptions: subscriptionsResult.data,
      billing: {
        total_invoices: invoicesResult.data.length,
        open_invoices: invoicesResult.data.filter(
          (invoice) => invoice.status === 'open',
        ).length,
        overdue_invoices: invoicesResult.data.filter(
          (invoice) => invoice.status === 'overdue',
        ).length,
        outstanding_cents: outstandingInvoices.reduce(
          (total, invoice) => total + invoice.amount_cents,
          0,
        ),
        next_due_date: nextDueDate,
      },
    },
  })
})

app.post('/admin/invoices', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to create invoice' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const result = adminInvoiceSchema.safeParse(request.body)

  if (!result.success) {
    response.status(400).json({ error: 'Enter valid invoice details' })
    return
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('id, user_id, status')
    .eq('id', result.data.subscription_id)
    .maybeSingle<{
      id: string
      user_id: string
      status: 'active' | 'past_due' | 'canceled'
    }>()

  if (subscriptionError) {
    console.error('Failed to verify invoice subscription', {
      code: subscriptionError.code,
    })
    response.status(500).json({ error: 'Unable to create invoice' })
    return
  }

  if (!subscription) {
    response.status(404).json({ error: 'Subscription not found' })
    return
  }

  if (subscription.status === 'canceled') {
    response.status(409).json({ error: 'Subscription is not current' })
    return
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      amount_cents: result.data.amount_cents,
      due_date: result.data.due_date,
      status: 'open',
      billing_period_start: result.data.billing_period_start,
      billing_period_end: result.data.billing_period_end,
    })
    .select(
      'id, amount_cents, due_date, status, billing_period_start, billing_period_end, created_at',
    )
    .single<CustomerInvoice>()

  if (error) {
    if (error.code === '23505') {
      response.status(409).json({
        error: 'An invoice already exists for this billing period',
      })
      return
    }

    console.error('Failed to create invoice', { code: error.code })
    response.status(500).json({ error: 'Unable to create invoice' })
    return
  }

  response.status(201).json({ invoice })
})

app.patch('/admin/invoices/:id/status', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to update invoice status' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = invoiceIdSchema.safeParse(request.params.id)
  const statusResult = adminInvoiceStatusSchema.safeParse(request.body)

  if (!idResult.success || !statusResult.success) {
    response.status(400).json({ error: 'Enter a valid invoice status' })
    return
  }

  const { data: existingInvoice, error: lookupError } = await supabase
    .from('invoices')
    .select('id, status, updated_at')
    .eq('id', idResult.data)
    .maybeSingle<{
      id: string
      status: 'open' | 'paid' | 'overdue'
      updated_at: string
    }>()

  if (lookupError) {
    console.error('Failed to load invoice status', { code: lookupError.code })
    response.status(500).json({ error: 'Unable to update invoice status' })
    return
  }

  if (!existingInvoice) {
    response.status(404).json({ error: 'Invoice not found' })
    return
  }

  const nextStatus = statusResult.data.status

  if (existingInvoice.status === nextStatus) {
    response.status(200).json({ invoice: existingInvoice })
    return
  }

  if (existingInvoice.status !== 'open') {
    response.status(409).json({ error: 'Invoice status transition is not allowed' })
    return
  }

  const updatedAt = new Date().toISOString()
  const { data: invoice, error } = await supabase
    .from('invoices')
    .update({ status: nextStatus, updated_at: updatedAt })
    .eq('id', existingInvoice.id)
    .eq('status', existingInvoice.status)
    .select('id, status, updated_at')
    .maybeSingle<{
      id: string
      status: 'open' | 'paid' | 'overdue'
      updated_at: string
    }>()

  if (error) {
    console.error('Failed to update invoice status', { code: error.code })
    response.status(500).json({ error: 'Unable to update invoice status' })
    return
  }

  if (!invoice) {
    response.status(409).json({ error: 'Invoice status has already changed' })
    return
  }

  response.status(200).json({ invoice })
})

app.get('/admin/subscriptions', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load subscriptions' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const queryResult = adminSubscriptionsQuerySchema.safeParse(request.query)

  if (!queryResult.success) {
    response.status(400).json({ error: 'Invalid subscription status filter' })
    return
  }

  let query = supabase
    .from('subscriptions')
    .select(
      `
        id,
        status,
        started_at,
        ended_at,
        customer:profiles!subscriptions_user_id_fkey(id, full_name),
        plan:plans!subscriptions_plan_id_fkey(id, name)
      `,
    )
    .order('started_at', { ascending: false })
    .order('id')

  if (!queryResult.data.status) {
    query = query.in('status', ['active', 'past_due'])
  } else if (queryResult.data.status !== 'all') {
    query = query.eq('status', queryResult.data.status)
  }

  const { data: subscriptions, error } =
    await query.returns<AdminSubscription[]>()

  if (error) {
    console.error('Failed to load admin subscriptions', { code: error.code })
    response.status(500).json({ error: 'Unable to load subscriptions' })
    return
  }

  response.status(200).json({ subscriptions })
})

app.get('/admin/subscriptions/:id', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load subscription' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = subscriptionIdSchema.safeParse(request.params.id)

  if (!idResult.success) {
    response.status(400).json({ error: 'Invalid subscription ID' })
    return
  }

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select(
      `
        id,
        status,
        started_at,
        ended_at,
        created_at,
        updated_at,
        customer:profiles!subscriptions_user_id_fkey(
          id,
          full_name,
          customer_profile:customer_profiles(phone, address, installation_address)
        ),
        plan:plans!subscriptions_plan_id_fkey(
          id,
          name,
          slug,
          speed_mbps,
          price_cents,
          billing_interval,
          is_active
        ),
        application:applications!subscriptions_application_id_fkey(
          id,
          status,
          submitted_at,
          installation_address
        )
      `,
    )
    .eq('id', idResult.data)
    .maybeSingle<AdminSubscriptionDetail>()

  if (error) {
    console.error('Failed to load admin subscription', { code: error.code })
    response.status(500).json({ error: 'Unable to load subscription' })
    return
  }

  if (!subscription) {
    response.status(404).json({ error: 'Subscription not found' })
    return
  }

  const [authResult, invoicesResult] = await Promise.all([
    subscription.customer
      ? supabase.auth.admin.getUserById(subscription.customer.id)
      : Promise.resolve({ data: { user: null }, error: null }),
    supabase
      .from('invoices')
      .select('amount_cents, due_date, status')
      .eq('subscription_id', subscription.id)
      .returns<AdminCustomerInvoiceSummaryRow[]>(),
  ])

  if (authResult.error || invoicesResult.error) {
    console.error('Failed to load admin subscription account information', {
      authError: authResult.error?.name,
      invoicesCode: invoicesResult.error?.code,
      subscriptionId: subscription.id,
    })
    response.status(500).json({ error: 'Unable to load subscription' })
    return
  }

  const outstandingInvoices = invoicesResult.data.filter(
    (invoice) => invoice.status === 'open' || invoice.status === 'overdue',
  )

  response.status(200).json({
    subscription: {
      ...subscription,
      customer: subscription.customer
        ? {
            ...subscription.customer,
            email: authResult.data.user?.email ?? null,
          }
        : null,
      billing: {
        total_invoices: invoicesResult.data.length,
        overdue_invoices: invoicesResult.data.filter(
          (invoice) => invoice.status === 'overdue',
        ).length,
        outstanding_cents: outstandingInvoices.reduce(
          (total, invoice) => total + invoice.amount_cents,
          0,
        ),
      },
    },
  })
})

app.patch('/admin/subscriptions/:id/status', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to update subscription status' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = subscriptionIdSchema.safeParse(request.params.id)
  const statusResult = adminSubscriptionStatusSchema.safeParse(request.body)

  if (!idResult.success || !statusResult.success) {
    response.status(400).json({ error: 'Enter a valid subscription status' })
    return
  }

  type SubscriptionStatus = 'active' | 'past_due' | 'canceled'
  const { data: existingSubscription, error: lookupError } = await supabase
    .from('subscriptions')
    .select('id, status, started_at, ended_at, updated_at')
    .eq('id', idResult.data)
    .maybeSingle<{
      id: string
      status: SubscriptionStatus
      started_at: string
      ended_at: string | null
      updated_at: string
    }>()

  if (lookupError) {
    console.error('Failed to load subscription status', {
      code: lookupError.code,
    })
    response.status(500).json({ error: 'Unable to update subscription status' })
    return
  }

  if (!existingSubscription) {
    response.status(404).json({ error: 'Subscription not found' })
    return
  }

  const nextStatus = statusResult.data.status

  if (existingSubscription.status === nextStatus) {
    response.status(200).json({ subscription: existingSubscription })
    return
  }

  const allowedTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    active: ['past_due', 'canceled'],
    past_due: ['active', 'canceled'],
    canceled: [],
  }

  if (!allowedTransitions[existingSubscription.status].includes(nextStatus)) {
    response.status(409).json({
      error: 'Subscription status transition is not allowed',
    })
    return
  }

  const updatedAt = new Date().toISOString()
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .update({
      status: nextStatus,
      ended_at: nextStatus === 'canceled' ? updatedAt : null,
      updated_at: updatedAt,
    })
    .eq('id', existingSubscription.id)
    .eq('status', existingSubscription.status)
    .select('id, status, started_at, ended_at, updated_at')
    .maybeSingle<{
      id: string
      status: SubscriptionStatus
      started_at: string
      ended_at: string | null
      updated_at: string
    }>()

  if (error) {
    console.error('Failed to update subscription status', {
      code: error.code,
      subscriptionId: existingSubscription.id,
    })
    response.status(500).json({ error: 'Unable to update subscription status' })
    return
  }

  if (!subscription) {
    response.status(409).json({ error: 'Subscription status already changed' })
    return
  }

  response.status(200).json({ subscription })
})

app.get('/admin/applications', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load applications' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const queryResult = adminApplicationsQuerySchema.safeParse(request.query)

  if (!queryResult.success) {
    response.status(400).json({ error: 'Invalid application status filter' })
    return
  }

  let query = supabase
    .from('applications')
    .select(
      `
        id,
        status,
        installation_address,
        submitted_at,
        rejection_reason,
        customer:profiles!applications_user_id_fkey(id, full_name),
        plan:plans(id, name)
      `,
    )
    .order('submitted_at', { ascending: false })
    .order('id')

  if (queryResult.data.status) {
    query = query.eq('status', queryResult.data.status)
  }

  const { data, error } = await query.returns<AdminApplication[]>()

  if (error) {
    console.error('Failed to load admin applications', { code: error.code })
    response.status(500).json({ error: 'Unable to load applications' })
    return
  }

  const statusOrder = { pending: 0, approved: 1, rejected: 2 }
  const applications = [...data].sort(
    (first, second) =>
      statusOrder[first.status] - statusOrder[second.status],
  )

  response.status(200).json({ applications })
})

app.get('/admin/applications/:id', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load application' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = applicationIdSchema.safeParse(request.params.id)

  if (!idResult.success) {
    response.status(400).json({ error: 'Invalid application ID' })
    return
  }

  const { data: application, error } = await supabase
    .from('applications')
    .select(
      `
        id,
        status,
        installation_address,
        submitted_at,
        reviewed_at,
        rejection_reason,
        customer:profiles!applications_user_id_fkey(
          id,
          full_name,
          customer_profile:customer_profiles(phone, address)
        ),
        plan:plans(id, name, description, billing_interval)
      `,
    )
    .eq('id', idResult.data)
    .maybeSingle<AdminApplicationDetail>()

  if (error) {
    console.error('Failed to load admin application', { code: error.code })
    response.status(500).json({ error: 'Unable to load application' })
    return
  }

  if (!application) {
    response.status(404).json({ error: 'Application not found' })
    return
  }

  response.status(200).json({ application })
})

app.get('/admin/support-tickets', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load support tickets' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const { data, error } = await supabase
    .from('support_tickets')
    .select(
      `
        id,
        subject,
        status,
        created_at,
        updated_at,
        customer:profiles!support_tickets_user_id_fkey(full_name)
      `,
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .returns<AdminSupportTicketSummary[]>()

  if (error) {
    console.error('Failed to load admin support tickets', { code: error.code })
    response.status(500).json({ error: 'Unable to load support tickets' })
    return
  }

  const statusOrder = { open: 0, in_progress: 1, resolved: 2, closed: 3 }
  const tickets = [...data].sort(
    (first, second) => statusOrder[first.status] - statusOrder[second.status],
  )

  response.status(200).json({ tickets })
})

app.get('/admin/support-tickets/:id', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to load support ticket' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = supportTicketIdSchema.safeParse(request.params.id)

  if (!idResult.success) {
    response.status(400).json({ error: 'Invalid support ticket ID' })
    return
  }

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .select(
      `
        id,
        subject,
        description,
        status,
        created_at,
        updated_at,
        resolved_at,
        customer:profiles!support_tickets_user_id_fkey(full_name)
      `,
    )
    .eq('id', idResult.data)
    .maybeSingle<AdminSupportTicketDetail>()

  if (error) {
    console.error('Failed to load admin support ticket', { code: error.code })
    response.status(500).json({ error: 'Unable to load support ticket' })
    return
  }

  if (!ticket) {
    response.status(404).json({ error: 'Support ticket not found' })
    return
  }

  const { data: responses, error: responsesError } = await supabase
    .from('support_ticket_responses')
    .select(
      `
        id,
        body,
        created_at,
        author:profiles!support_ticket_responses_admin_id_fkey(full_name)
      `,
    )
    .eq('ticket_id', ticket.id)
    .order('created_at')
    .order('id')
    .returns<SupportTicketResponse[]>()

  if (responsesError) {
    console.error('Failed to load admin support ticket responses', {
      code: responsesError.code,
      ticketId: ticket.id,
    })
    response.status(500).json({ error: 'Unable to load support ticket' })
    return
  }

  response.status(200).json({ ticket: { ...ticket, responses } })
})

app.post('/admin/support-tickets/:id/responses', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to add support response' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = supportTicketIdSchema.safeParse(request.params.id)
  const bodyResult = supportTicketResponseSchema.safeParse(request.body)

  if (!idResult.success || !bodyResult.success) {
    response.status(400).json({ error: 'Enter a valid support response' })
    return
  }

  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .select('id')
    .eq('id', idResult.data)
    .maybeSingle<{ id: string }>()

  if (ticketError) {
    console.error('Failed to verify support ticket response target', {
      code: ticketError.code,
    })
    response.status(500).json({ error: 'Unable to add support response' })
    return
  }

  if (!ticket) {
    response.status(404).json({ error: 'Support ticket not found' })
    return
  }

  const { data: ticketResponse, error } = await supabase
    .from('support_ticket_responses')
    .insert({
      ticket_id: ticket.id,
      admin_id: auth.userId,
      body: bodyResult.data.body,
    })
    .select(
      `
        id,
        body,
        created_at,
        author:profiles!support_ticket_responses_admin_id_fkey(full_name)
      `,
    )
    .single<SupportTicketResponse>()

  if (error) {
    console.error('Failed to create support ticket response', {
      code: error.code,
      ticketId: ticket.id,
    })
    response.status(500).json({ error: 'Unable to add support response' })
    return
  }

  response.status(201).json({ response: ticketResponse })
})

app.patch('/admin/support-tickets/:id/status', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to update support ticket' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = supportTicketIdSchema.safeParse(request.params.id)
  const statusResult = adminSupportTicketStatusSchema.safeParse(request.body)

  if (!idResult.success || !statusResult.success) {
    response.status(400).json({ error: 'Enter a valid support ticket status' })
    return
  }

  type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

  const { data: existingTicket, error: lookupError } = await supabase
    .from('support_tickets')
    .select('id, status, updated_at, resolved_at')
    .eq('id', idResult.data)
    .maybeSingle<{
      id: string
      status: SupportTicketStatus
      updated_at: string
      resolved_at: string | null
    }>()

  if (lookupError) {
    console.error('Failed to load support ticket status', {
      code: lookupError.code,
    })
    response.status(500).json({ error: 'Unable to update support ticket' })
    return
  }

  if (!existingTicket) {
    response.status(404).json({ error: 'Support ticket not found' })
    return
  }

  const nextStatus = statusResult.data.status

  if (existingTicket.status === nextStatus) {
    response.status(200).json({ ticket: existingTicket })
    return
  }

  const allowedTransitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
    open: ['in_progress'],
    in_progress: ['resolved'],
    resolved: ['in_progress', 'closed'],
    closed: [],
  }

  if (!allowedTransitions[existingTicket.status].includes(nextStatus)) {
    response.status(409).json({ error: 'Ticket status transition is not allowed' })
    return
  }

  const updatedAt = new Date().toISOString()
  const resolvedAt =
    nextStatus === 'resolved'
      ? updatedAt
      : nextStatus === 'in_progress'
        ? null
        : existingTicket.resolved_at

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .update({
      status: nextStatus,
      updated_at: updatedAt,
      resolved_at: resolvedAt,
    })
    .eq('id', existingTicket.id)
    .eq('status', existingTicket.status)
    .select('id, status, updated_at, resolved_at')
    .maybeSingle<{
      id: string
      status: SupportTicketStatus
      updated_at: string
      resolved_at: string | null
    }>()

  if (error) {
    console.error('Failed to update support ticket status', {
      code: error.code,
      ticketId: existingTicket.id,
    })
    response.status(500).json({ error: 'Unable to update support ticket' })
    return
  }

  if (!ticket) {
    response.status(409).json({ error: 'Support ticket status already changed' })
    return
  }

  response.status(200).json({ ticket })
})

app.patch('/admin/applications/:id/review', async (request, response) => {
  const auth = await authorizeRole(request.header('authorization'), 'admin')

  if (auth.status !== 200 || !auth.userId) {
    if (auth.status === 500) {
      response.status(500).json({ error: 'Unable to review application' })
      return
    }

    const message =
      auth.status === 403 ? 'Admin access required' : 'Authentication required'
    response.status(auth.status).json({ error: message })
    return
  }

  const idResult = applicationIdSchema.safeParse(request.params.id)
  const reviewResult = applicationReviewSchema.safeParse(request.body)

  if (!idResult.success || !reviewResult.success) {
    response.status(400).json({ error: 'Enter a valid review decision' })
    return
  }

  const { data: applicationOwner, error: ownerError } = await supabase
    .from('applications')
    .select('user_id')
    .eq('id', idResult.data)
    .maybeSingle<{ user_id: string }>()

  if (ownerError) {
    console.error('Failed to load application owner', { code: ownerError.code })
    response.status(500).json({ error: 'Unable to review application' })
    return
  }

  if (!applicationOwner) {
    response.status(404).json({ error: 'Application not found' })
    return
  }

  if (reviewResult.data.status === 'approved') {
    const { data: application, error } = await supabase
      .rpc('approve_application', {
        p_application_id: idResult.data,
        p_reviewer_id: auth.userId,
      })
      .single<{
        id: string
        status: 'approved'
        reviewed_at: string
        rejection_reason: null
      }>()

    if (error) {
      if (error.code === 'P0002') {
        response.status(404).json({ error: 'Application not found' })
        return
      }

      if (error.code === 'P0001' || error.code === '23505') {
        response.status(409).json({
          error: 'Application cannot be approved in its current state',
        })
        return
      }

      console.error('Failed to approve application', { code: error.code })
      response.status(500).json({ error: 'Unable to review application' })
      return
    }

    await sendApplicationStatusEmail(
      applicationOwner.user_id,
      'approved',
      null,
    )

    response.status(200).json({ application })
    return
  }

  const reviewedAt = new Date().toISOString()

  const { data: application, error } = await supabase
    .from('applications')
    .update({
      status: 'rejected',
      reviewed_at: reviewedAt,
      reviewed_by: auth.userId,
      rejection_reason: reviewResult.data.rejection_reason,
      updated_at: reviewedAt,
    })
    .eq('id', idResult.data)
    .eq('status', 'pending')
    .select('id, status, reviewed_at, rejection_reason')
    .maybeSingle<{
      id: string
      status: 'rejected'
      reviewed_at: string
      rejection_reason: string | null
    }>()

  if (error) {
    console.error('Failed to review application', { code: error.code })
    response.status(500).json({ error: 'Unable to review application' })
    return
  }

  if (!application) {
    const { data: existingApplication, error: lookupError } = await supabase
      .from('applications')
      .select('id')
      .eq('id', idResult.data)
      .maybeSingle<{ id: string }>()

    if (lookupError) {
      console.error('Failed to verify application review conflict', {
        code: lookupError.code,
      })
      response.status(500).json({ error: 'Unable to review application' })
      return
    }

    if (!existingApplication) {
      response.status(404).json({ error: 'Application not found' })
      return
    }

    response.status(409).json({ error: 'Application has already been reviewed' })
    return
  }

  await sendApplicationStatusEmail(
    applicationOwner.user_id,
    'rejected',
    application.rejection_reason,
  )

  response.status(200).json({ application })
})

export default app
