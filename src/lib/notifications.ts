/**
 * lib/notifications.ts
 * Creates in-app notifications for key PIOS events.
 * Called server-side from API routes after significant actions.
 *
 * PIOS v2.0 | Sustain International FZE Ltd
 */
import { createClient } from '@/lib/supabase/server'

interface NotificationPayload {
  userId:    string
  title:     string
  body?:     string
  type?:     'info' | 'warning' | 'critical' | 'success' | 'ai'
  domain?:   string
  actionUrl?: string
}

/**
 * Write a notification for a user. Silently ignores errors — never
 * let notification creation break the caller's primary response.
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from('notifications').insert({
      user_id:    payload.userId,
      title:      payload.title,
      body:       payload.body ?? null,
      type:       payload.type ?? 'info',
      domain:     payload.domain ?? null,
      action_url: payload.actionUrl ?? null,
      read:       false,
    })
  } catch {
    // Silent — notifications are best-effort
  }
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllRead(userId: string): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  } catch { /* silent */ }
}
