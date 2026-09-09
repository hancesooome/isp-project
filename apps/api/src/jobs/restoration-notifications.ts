import { env } from '../config/env.js'
import { sendEmail } from '../lib/email.js'
import { supabase } from '../lib/supabase.js'

interface RestorationNotification {
  id: string
  subscription_id: string
  triggering_invoice_id: string | null
  restored_at: string
  reason: 'verified_payment' | 'manual'
  manual_reason: string | null
}

export async function sendRestorationNotifications() {
  const { data: history, error } = await supabase
    .from('subscription_restoration_history')
    .select('id, subscription_id, triggering_invoice_id, restored_at, reason, manual_reason')
    .is('email_claimed_at', null)
    .order('restored_at')
    .order('id')
    .returns<RestorationNotification[]>()

  if (error) {
    console.error('Failed to load restoration notifications', {
      code: error.code,
    })
    throw new Error('RESTORATION_NOTIFICATIONS_FAILED')
  }

  let sentRestorationNotifications = 0
  let skippedRestorationNotifications = 0

  for (const notification of history) {
    const claimedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await supabase
      .from('subscription_restoration_history')
      .update({ email_claimed_at: claimedAt })
      .eq('id', notification.id)
      .is('email_claimed_at', null)
      .select('id')
      .maybeSingle<{ id: string }>()

    if (claimError || !claimed) {
      if (claimError) {
        console.error('Failed to claim restoration notification', {
          code: claimError.code,
          historyId: notification.id,
        })
      }
      skippedRestorationNotifications += 1
      continue
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('id', notification.subscription_id)
      .maybeSingle<{ user_id: string }>()

    if (subscriptionError || !subscription) {
      console.error('Failed to load restored subscription customer', {
        code: subscriptionError?.code ?? 'SUBSCRIPTION_NOT_FOUND',
        historyId: notification.id,
      })
      await releaseClaim(notification.id, claimedAt)
      skippedRestorationNotifications += 1
      continue
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(subscription.user_id)
    const email = userData.user?.email

    if (userError || !email) {
      console.error('Failed to load restored customer email', {
        code: userError?.code ?? 'EMAIL_NOT_FOUND',
        historyId: notification.id,
      })
      await releaseClaim(notification.id, claimedAt)
      skippedRestorationNotifications += 1
      continue
    }

    const accountUrl = new URL('/account', env.appUrl).toString()
    const invoiceReference = notification.triggering_invoice_id
      ?.slice(0, 8)
      .toUpperCase()
    const reasonText = notification.reason === 'manual'
      ? `An administrator restored your account service to active status. Reason: ${notification.manual_reason ?? 'Operational review'}.`
      : `Your account service has been restored to active status after verified payment of invoice #${invoiceReference ?? 'unknown'} resolved all due debt.`
    const reasonHtml = notification.reason === 'manual'
      ? `<p>An administrator restored your account service to <strong>active</strong> status.</p><p><strong>Reason:</strong> ${escapeHtml(notification.manual_reason ?? 'Operational review')}</p>`
      : `<p>Your account service has been restored to <strong>active</strong> status after verified payment of invoice <strong>#${invoiceReference ?? 'unknown'}</strong> resolved all due debt.</p>`
    const result = await sendEmail({
      to: email,
      subject: 'Your ISP account service is active again',
      text: `${reasonText} This confirms the platform account status only and does not confirm a physical network change. View your account: ${accountUrl}`,
      html: `${reasonHtml}<p>This confirms the platform account status only and does not confirm a physical network change.</p><p><a href="${accountUrl}">View your account</a></p>`,
    })

    if (result.success) {
      sentRestorationNotifications += 1
      continue
    }

    await releaseClaim(notification.id, claimedAt)
    skippedRestorationNotifications += 1
  }

  return {
    eligibleRestorationNotifications: history.length,
    sentRestorationNotifications,
    skippedRestorationNotifications,
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function releaseClaim(historyId: string, claimedAt: string) {
  const { error } = await supabase
    .from('subscription_restoration_history')
    .update({ email_claimed_at: null })
    .eq('id', historyId)
    .eq('email_claimed_at', claimedAt)

  if (error) {
    console.error('Failed to release restoration notification claim', {
      code: error.code,
      historyId,
    })
  }
}
