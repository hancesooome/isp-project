import { supabase } from './supabase.js'

type AuditActor =
  | { actorType: 'admin'; actorId: string | undefined }
  | { actorType: 'system'; actorId?: never }

interface AuditTarget {
  action: string
  targetType: string
  targetId: string
  source: 'api' | 'stripe_webhook' | 'scheduled_job'
  metadata?: Record<string, string | number | boolean | null>
}

export async function recordAuditEvent(
  event: AuditActor & AuditTarget,
): Promise<boolean> {
  if (event.actorType === 'admin' && !event.actorId) {
    console.error('Failed to record audit event', {
      reason: 'ADMIN_ACTOR_MISSING',
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
    })
    return false
  }

  try {
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: event.actorType === 'admin' ? event.actorId : null,
      actor_type: event.actorType,
      action: event.action,
      target_type: event.targetType,
      target_id: event.targetId,
      source: event.source,
      metadata: event.metadata ?? {},
    })

    if (!error) {
      return true
    }

    console.error('Failed to record audit event', {
      code: error.code,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
    })
    return false
  } catch {
    console.error('Failed to record audit event', {
      reason: 'AUDIT_REQUEST_FAILED',
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
    })
    return false
  }
}
