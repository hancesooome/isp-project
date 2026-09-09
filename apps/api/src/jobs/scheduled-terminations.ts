import { env } from '../config/env.js'
import { recordAuditEvent } from '../lib/audit.js'
import { sendEmail } from '../lib/email.js'
import { supabase } from '../lib/supabase.js'

interface TerminationResult {
  request_id: string
  subscription_id: string
  outcome: 'completed' | 'rejected'
}

export interface ScheduledTerminationResult {
  completed: number
  rejected: number
  notificationsSent: number
}

export async function applyScheduledTerminations(now = new Date()): Promise<ScheduledTerminationResult> {
  const { data: rawData, error } = await supabase.rpc('apply_scheduled_service_terminations', {
    p_now: now.toISOString(),
  })

  if (error || !isTerminationResults(rawData)) {
    console.error('Failed to apply scheduled service terminations', { code: error?.code ?? 'INVALID_RESULT' })
    throw new Error('SCHEDULED_TERMINATIONS_FAILED')
  }

  const data = rawData

  for (const result of data) {
    await recordAuditEvent({
      actorType: 'system',
      action: result.outcome === 'completed' ? 'subscription.terminated' : 'cancellation_request.processing_rejected',
      targetType: result.outcome === 'completed' ? 'subscription' : 'cancellation_request',
      targetId: result.outcome === 'completed' ? result.subscription_id : result.request_id,
      source: 'scheduled_job',
      metadata: { cancellation_request_id: result.request_id },
    })
  }

  const notificationsSent = await sendTerminationNotifications()
  return {
    completed: data.filter((item) => item.outcome === 'completed').length,
    rejected: data.filter((item) => item.outcome === 'rejected').length,
    notificationsSent,
  }
}

function isTerminationResults(value: unknown): value is TerminationResult[] {
  return Array.isArray(value) && value.every((item) =>
    typeof item === 'object' && item !== null
    && 'request_id' in item && typeof item.request_id === 'string'
    && 'subscription_id' in item && typeof item.subscription_id === 'string'
    && 'outcome' in item && (item.outcome === 'completed' || item.outcome === 'rejected'))
}

async function sendTerminationNotifications(): Promise<number> {
  const { data: requests, error } = await supabase
    .from('cancellation_requests')
    .select('id, user_id, effective_termination_date')
    .eq('status', 'completed')
    .is('termination_email_claimed_at', null)
    .order('processed_at')
    .limit(100)
    .returns<Array<{ id: string; user_id: string; effective_termination_date: string }>>()

  if (error) throw new Error('TERMINATION_NOTIFICATIONS_LOAD_FAILED')

  let sent = 0
  for (const request of requests) {
    const claimedAt = new Date().toISOString()
    const { data: claimed } = await supabase
      .from('cancellation_requests')
      .update({ termination_email_claimed_at: claimedAt })
      .eq('id', request.id)
      .is('termination_email_claimed_at', null)
      .select('id')
      .maybeSingle<{ id: string }>()
    if (!claimed) continue

    const authResult = await supabase.auth.admin.getUserById(request.user_id)
    const email = authResult.data.user?.email
    if (!email) {
      await releaseClaim(request.id, claimedAt)
      continue
    }

    const accountUrl = new URL('/account', env.appUrl).toString()
    const result = await sendEmail({
      to: email,
      subject: 'Your ISP service cancellation is complete',
      text: `Your service was terminated in the account platform effective ${request.effective_termination_date}. Existing invoices, payments, and statements remain available in your account. This does not independently confirm a physical network equipment change. View your account: ${accountUrl}`,
      html: `<p>Your service was terminated in the account platform effective <strong>${request.effective_termination_date}</strong>.</p><p>Existing invoices, payments, and statements remain available in your account.</p><p>This does not independently confirm a physical network equipment change.</p><p><a href="${accountUrl}">View your account</a></p>`,
    })

    if (result.success) sent += 1
    else await releaseClaim(request.id, claimedAt)
  }
  return sent
}

async function releaseClaim(requestId: string, claimedAt: string) {
  await supabase.from('cancellation_requests')
    .update({ termination_email_claimed_at: null })
    .eq('id', requestId)
    .eq('termination_email_claimed_at', claimedAt)
}
