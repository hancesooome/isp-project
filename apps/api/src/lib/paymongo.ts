import { env } from '../config/env.js'

const PAYMONGO_API_URL = 'https://api.paymongo.com/v1'

export function isPayMongoEnabled() {
  return env.payMongoMode !== 'disabled'
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
