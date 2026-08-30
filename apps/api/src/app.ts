import express from 'express'
import { z } from 'zod'

import { env } from './config/env.js'
import { supabase } from './lib/supabase.js'
import { stripe } from './lib/stripe.js'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
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
  status: 'active' | 'past_due'
  customer: { id: string; full_name: string | null } | null
  plan: { id: string; name: string } | null
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
const invoiceIdSchema = z.string().uuid()

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
    status: z.enum(['open', 'paid', 'overdue']),
  })
  .strict()

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
      event.type !== 'checkout.session.async_payment_succeeded'
    ) {
      response.status(200).json({ received: true })
      return
    }

    const checkoutSession = event.data.object

    if (
      checkoutSession.mode !== 'payment' ||
      checkoutSession.payment_status !== 'paid'
    ) {
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
      console.warn('Ignored paid Stripe Checkout Session with invalid references', {
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
    const { error: paymentError } = await supabase.from('payments').insert({
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      amount_cents: invoice.amount_cents,
      provider: 'stripe',
      provider_reference: paymentIntentReference,
      status: 'succeeded',
      paid_at: paidAt,
      updated_at: paidAt,
    })

    if (paymentError) {
      if (paymentError.code === '23505') {
        const { data: existingPayment, error: duplicateLookupError } =
          await supabase
            .from('payments')
            .select('id')
            .eq('provider', 'stripe')
            .eq('provider_reference', paymentIntentReference)
            .maybeSingle<{ id: string }>()

        if (duplicateLookupError) {
          console.error('Failed to verify duplicate Stripe payment', {
            code: duplicateLookupError.code,
            eventId: event.id,
          })
          response.status(500).json({ error: 'Unable to process webhook' })
          return
        }

        if (existingPayment) {
          response.status(200).json({ received: true })
          return
        }

        console.error('Stripe payment conflicted with invoice payment history', {
          eventId: event.id,
        })
        response.status(500).json({ error: 'Unable to process webhook' })
        return
      }

      console.error('Failed to record Stripe payment', {
        code: paymentError.code,
        eventId: event.id,
      })
      response.status(500).json({ error: 'Unable to process webhook' })
      return
    }

    response.status(200).json({ received: true })
  },
)

app.use(express.json({ limit: '10kb' }))

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' })
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

  const allowedTransitions: Record<
    typeof existingInvoice.status,
    Array<typeof nextStatus>
  > = {
    open: ['paid', 'overdue'],
    overdue: ['paid'],
    paid: [],
  }

  if (!allowedTransitions[existingInvoice.status].includes(nextStatus)) {
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

  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select(
      `
        id,
        status,
        customer:profiles!subscriptions_user_id_fkey(id, full_name),
        plan:plans!subscriptions_plan_id_fkey(id, name)
      `,
    )
    .in('status', ['active', 'past_due'])
    .order('started_at', { ascending: false })
    .order('id')
    .returns<AdminSubscription[]>()

  if (error) {
    console.error('Failed to load admin subscriptions', { code: error.code })
    response.status(500).json({ error: 'Unable to load subscriptions' })
    return
  }

  response.status(200).json({ subscriptions })
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

  response.status(200).json({ application })
})
