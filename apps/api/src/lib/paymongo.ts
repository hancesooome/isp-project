import { createHmac, timingSafeEqual } from 'node:crypto'

import { env } from '../config/env.js'

const PAYMONGO_API_URL = 'https://api.paymongo.com/v1'

export function isPayMongoEnabled() {
  return env.payMongoMode !== 'disabled'
}

export function verifyPayMongoWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
) {
  if (!env.payMongoWebhookSecret || env.payMongoMode === 'disabled') return false

  const parts = new Map(
    signatureHeader.split(',').map((part) => {
      const separator = part.indexOf('=')
      return separator === -1
        ? [part.trim(), '']
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
    }),
  )
  const timestamp = parts.get('t')
  const signature = parts.get(env.payMongoMode === 'test' ? 'te' : 'li')

  if (!timestamp || !/^\d+$/.test(timestamp) || !signature) return false

  const timestampSeconds = Number(timestamp)
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > 300
  ) return false

  const expected = createHmac('sha256', env.payMongoWebhookSecret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest()
  const received = Buffer.from(signature, 'hex')

  return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function payMongoRequest<T>(
  path: `/${string}`,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<T> {
  if (!env.payMongoSecretKey || env.payMongoMode === 'disabled') {
    throw new Error('PAYMONGO_DISABLED')
  }

  const response = await fetch(`${PAYMONGO_API_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${env.payMongoSecretKey}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  })

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error('PAYMONGO_REQUEST_FAILED')
    Object.assign(error, { status: response.status })
    throw error
  }

  return body as T
}
