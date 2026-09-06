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

const paymentMethodResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
  }),
})

const attachedPaymentIntentResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      status: z.string().min(1),
      next_action: z.object({
        redirect: z.object({
          url: z.string().url(),
        }).optional(),
        code: z.object({
          image_url: z.string().max(1_500_000),
        }).optional(),
      }).nullable().optional(),
    }),
  }),
})

const retrievedPaymentIntentResponseSchema = z.object({
  data: z.object({
    attributes: z.object({
      status: z.string().min(1),
      last_payment_error: z.unknown().nullable().optional(),
    }),
  }),
})

interface CreatePaymentIntentRequest {
  invoiceId: string
  amountCents: number
  currency: string
  paymentMethods?: Array<'gcash' | 'paymaya' | 'qrph'>
}

type PayMongoPaymentMethod = 'gcash' | 'paymaya' | 'qrph'

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
          payment_method_allowed: request.paymentMethods ?? ['gcash', 'paymaya', 'qrph'],
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

export async function createPayMongoPaymentMethod(
  type: PayMongoPaymentMethod,
) {
  const response = await payMongoRequest<unknown>('/payment_methods', {
    method: 'POST',
    body: JSON.stringify({
      data: { attributes: { type } },
    }),
  })

  return paymentMethodResponseSchema.parse(response).data.id
}

export async function attachPayMongoPaymentMethod(request: {
  paymentIntentId: string
  clientKey: string
  paymentMethodId: string
  returnUrl?: string
}) {
  const response = await payMongoRequest<unknown>(
    `/payment_intents/${encodeURIComponent(request.paymentIntentId)}/attach`,
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          attributes: {
            payment_method: request.paymentMethodId,
            client_key: request.clientKey,
            ...(request.returnUrl ? { return_url: request.returnUrl } : {}),
          },
        },
      }),
    },
  )

  const paymentIntent = attachedPaymentIntentResponseSchema.parse(response).data
  const redirectUrl = paymentIntent.attributes.next_action?.redirect?.url ?? null
  const qrImageUrl = paymentIntent.attributes.next_action?.code?.image_url ?? null

  if (redirectUrl && new URL(redirectUrl).protocol !== 'https:') {
    throw new Error('PAYMONGO_REDIRECT_URL_INVALID')
  }

  if (
    qrImageUrl &&
    !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(qrImageUrl)
  ) {
    throw new Error('PAYMONGO_QR_IMAGE_INVALID')
  }

  return {
    id: paymentIntent.id,
    status: paymentIntent.attributes.status,
    redirectUrl,
    qrImageUrl,
  }
}

export async function retrievePayMongoPaymentIntent(paymentIntentId: string) {
  const response = await payMongoRequest<unknown>(
    `/payment_intents/${encodeURIComponent(paymentIntentId)}`,
  )
  const paymentIntent = retrievedPaymentIntentResponseSchema.parse(response).data

  return {
    status: paymentIntent.attributes.status,
    hasPaymentError: paymentIntent.attributes.last_payment_error != null,
  }
}
