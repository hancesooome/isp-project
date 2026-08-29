import express from 'express'

import { supabase } from './lib/supabase.js'

interface Plan {
  id: string
  name: string
  slug: string
  description: string | null
  price_cents: number
  billing_interval: 'monthly' | 'yearly'
}

export const app = express()

app.disable('x-powered-by')

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
