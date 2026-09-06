import { z } from 'zod'

import { payMongoRequest } from '../lib/paymongo.js'

const paymentIntentResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      client_key: z.string().min(1),
      status: z.string().min(1),
    }),
  }),
})

interface CreatePaymentIntentRequest {
  invoiceId: string
  amountCents: number
  currency: string
}

export async function createPayMongoPaymentIntent(
  request: CreatePaymentIntentRequest,
) {
  const response = await payMongoRequest<unknown>('/payment_intents', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        attributes: {
          amount: request.amountCents,
          currency: request.currency,
          description: `ISP invoice #${request.invoiceId.slice(0, 8).toUpperCase()}`,
          payment_method_allowed: ['gcash', 'paymaya', 'qrph'],
          payment_method_options: {
            card: { request_three_d_secure: 'automatic' },
          },
        },
      },
    }),
  })

  const paymentIntent = paymentIntentResponseSchema.parse(response).data

  return {
    id: paymentIntent.id,
    clientKey: paymentIntent.attributes.client_key,
    status: paymentIntent.attributes.status,
  }
}
