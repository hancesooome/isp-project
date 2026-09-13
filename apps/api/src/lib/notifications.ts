import { supabase } from './supabase.js'

interface NotificationInput {
  recipientId: string
  audience: 'customer' | 'admin'
  type: string
  title: string
  message: string
  relatedEntityType?: string
  relatedEntityId?: string
  navigationPath?: string
  sourceEventKey?: string
}

type AdminNotificationInput = Omit<NotificationInput, 'recipientId' | 'audience'>

export async function createNotification(
  notification: NotificationInput,
): Promise<boolean> {
  try {
    const { error } = await supabase.from('notifications').upsert(
      {
        recipient_id: notification.recipientId,
        audience: notification.audience,
        notification_type: notification.type,
        title: notification.title,
        message: notification.message,
        related_entity_type: notification.relatedEntityType ?? null,
        related_entity_id: notification.relatedEntityId ?? null,
        navigation_path: notification.navigationPath ?? null,
        source_event_key: notification.sourceEventKey ?? null,
      },
      {
        onConflict: 'recipient_id,source_event_key',
        ignoreDuplicates: true,
      },
    )

    if (!error) return true

    console.error('Failed to create notification', {
      code: error.code,
      type: notification.type,
      recipientId: notification.recipientId,
    })
    return false
  } catch {
    console.error('Failed to create notification', {
      reason: 'NOTIFICATION_REQUEST_FAILED',
      type: notification.type,
      recipientId: notification.recipientId,
    })
    return false
  }
}

export async function createAdminNotifications(
  notification: AdminNotificationInput,
): Promise<boolean> {
  const { data: administrators, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .returns<Array<{ id: string }>>()

  if (error) {
    console.error('Failed to load admin notification recipients', {
      code: error.code,
      type: notification.type,
    })
    return false
  }

  const results = await Promise.all(administrators.map((administrator) =>
    createNotification({
      ...notification,
      recipientId: administrator.id,
      audience: 'admin',
    }),
  ))

  return results.every(Boolean)
}
