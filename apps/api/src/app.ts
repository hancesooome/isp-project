import express from 'express'
import { z } from 'zod'

import { env } from './config/env.js'
import { supabase } from './lib/supabase.js'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
}

interface CustomerAuthResult {
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

function isServiceAvailable(address: string): boolean {
  const normalizedAddress = address.toLowerCase()
  return env.serviceAreaKeywords.some((area) =>
    normalizedAddress.includes(area),
  )
}

async function authenticateCustomer(
  authorizationHeader: string | undefined,
): Promise<CustomerAuthResult> {
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
    console.error('Failed to verify customer role', {
      code: profileError.code,
    })
    return { status: 500 }
  }

  if (profile?.role !== 'customer') {
    return { status: 403 }
  }

  return { status: 200, userId: user.id }
}

export const app = express()

app.disable('x-powered-by')
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
  const auth = await authenticateCustomer(request.header('authorization'))

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
  const auth = await authenticateCustomer(request.header('authorization'))

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
