import { Resend } from 'resend'

import { env } from '../config/env.js'

const resend = new Resend(env.resendApiKey)

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text: string
}

type SendEmailResult =
  | { success: true; id: string }
  | { success: false }

export async function sendEmail(
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: env.emailFrom,
      ...options,
    })

    if (error || !data) {
      console.error('Failed to send transactional email', {
        provider: 'resend',
        error: error?.name ?? 'UnknownError',
      })
      return { success: false }
    }

    return { success: true, id: data.id }
  } catch {
    console.error('Failed to send transactional email', {
      provider: 'resend',
      error: 'RequestFailed',
    })
    return { success: false }
  }
}
