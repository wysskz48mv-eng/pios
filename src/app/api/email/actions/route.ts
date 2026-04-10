/**
 * POST /api/email/actions
 * Handles all email quick actions: archive, delete, spam, block,
 * unsubscribe, flag, snooze, mark read/unread.
 *
 * Body: { email_id, action, value? }
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'

const VALID_ACTIONS = [
  'archive', 'unarchive', 'delete', 'spam', 'not_spam',
  'block', 'unblock', 'unsubscribe', 'flag', 'unflag',
  'snooze', 'unsnooze', 'mark_read', 'mark_unread',
  'create_task', 'extract_invoice',
]

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { email_id, action, value } = body as { email_id: string; action: string; value?: string }

    if (!email_id) return NextResponse.json({ error: 'email_id required' }, { status: 400 })
    if (!VALID_ACTIONS.includes(action)) return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })

    // Verify email belongs to user
    const { data: email } = await supabase
      .from('email_items')
      .select('id, sender_email, gmail_message_id, status, account_id')
      .eq('id', email_id)
      .eq('user_id', user.id)
      .single()

    if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

    // ── Execute action ──────────────────────────────────────────────────────

    if (action === 'archive') {
      await supabase.from('email_items').update({ status: 'archived' }).eq('id', email_id)
      await gmailModify(supabase, user.id, email, ['INBOX'], [])
    }

    if (action === 'unarchive') {
      await supabase.from('email_items').update({ status: 'triaged' }).eq('id', email_id)
      await gmailModify(supabase, user.id, email, [], ['INBOX'])
    }

    if (action === 'delete') {
      await supabase.from('email_items').update({ status: 'deleted' }).eq('id', email_id)
      await gmailTrash(supabase, user.id, email)
    }

    if (action === 'spam') {
      await supabase.from('email_items').update({ status: 'spam', is_spam: true }).eq('id', email_id)
      await gmailModify(supabase, user.id, email, ['INBOX'], ['SPAM'])
    }

    if (action === 'not_spam') {
      await supabase.from('email_items').update({ status: 'triaged', is_spam: false }).eq('id', email_id)
      await gmailModify(supabase, user.id, email, ['SPAM'], ['INBOX'])
    }

    if (action === 'block') {
      const senderEmail = email.sender_email
      const domain = senderEmail?.split('@')[1] ?? null
      await supabase.from('blocked_senders').upsert({
        user_id: user.id,
        email: senderEmail,
        domain,
        reason: value ?? 'User blocked',
      }, { onConflict: 'user_id,email' })
      await supabase.from('email_items').update({ is_blocked: true, status: 'spam' }).eq('id', email_id)
    }

    if (action === 'unblock') {
      await supabase.from('blocked_senders').delete()
        .eq('user_id', user.id)
        .eq('email', email.sender_email)
      await supabase.from('email_items').update({ is_blocked: false }).eq('id', email_id)
    }

    if (action === 'unsubscribe') {
      // Fetch unsubscribe URL if we have it
      const { data: full } = await supabase
        .from('email_items')
        .select('unsubscribe_url')
        .eq('id', email_id)
        .single()

      if (full?.unsubscribe_url) {
        // Auto-unsubscribe via URL
        try { await fetch(full.unsubscribe_url, { method: 'POST' }).catch(() => fetch(full.unsubscribe_url!)) } catch {}
      }

      await supabase.from('email_items').update({ status: 'archived' }).eq('id', email_id)

      // Block future emails from this sender
      await supabase.from('blocked_senders').upsert({
        user_id: user.id,
        email: email.sender_email,
        domain: email.sender_email?.split('@')[1] ?? null,
        reason: 'Unsubscribed',
      }, { onConflict: 'user_id,email' })
    }

    if (action === 'flag') {
      await supabase.from('email_items').update({ is_flagged: true }).eq('id', email_id)
    }

    if (action === 'unflag') {
      await supabase.from('email_items').update({ is_flagged: false }).eq('id', email_id)
    }

    if (action === 'snooze') {
      const snoozeUntil = value ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('snoozed_emails').upsert({
        user_id: user.id,
        email_item_id: email_id,
        snooze_until: snoozeUntil,
        original_status: email.status,
      }, { onConflict: 'user_id,email_item_id' })
      await supabase.from('email_items').update({ is_snoozed: true, status: 'snoozed' }).eq('id', email_id)
    }

    if (action === 'unsnooze') {
      const { data: snoozed } = await supabase
        .from('snoozed_emails')
        .select('original_status')
        .eq('email_item_id', email_id)
        .eq('user_id', user.id)
        .single()

      await supabase.from('snoozed_emails').delete().eq('email_item_id', email_id).eq('user_id', user.id)
      await supabase.from('email_items').update({
        is_snoozed: false,
        status: snoozed?.original_status ?? 'triaged',
      }).eq('id', email_id)
    }

    if (action === 'mark_read') {
      await supabase.from('email_items').update({ status: 'read' }).eq('id', email_id)
      await gmailModify(supabase, user.id, email, ['UNREAD'], [])
    }

    if (action === 'mark_unread') {
      await supabase.from('email_items').update({ status: 'triaged' }).eq('id', email_id)
      await gmailModify(supabase, user.id, email, [], ['UNREAD'])
    }

    // Log the action
    await supabase.from('email_actions').insert({
      user_id: user.id,
      email_item_id: email_id,
      gmail_message_id: email.gmail_message_id,
      action,
      action_value: value ?? null,
    })

    return NextResponse.json({ ok: true, action, email_id })
  } catch (err) {
    console.error('[PIOS email/actions]', err)
    return apiError(err)
  }
}

// ── Gmail helpers ───────────────────────────────────────────────────────────

async function getGmailToken(supabase: any, userId: string, email: any): Promise<string | null> {
  if (email.account_id) {
    const { data: acct } = await supabase
      .from('connected_email_accounts')
      .select('google_access_token_enc, google_refresh_token_enc, google_token_expiry')
      .eq('id', email.account_id)
      .single()
    if (acct?.google_access_token_enc) {
      const expiry = acct.google_token_expiry ? new Date(acct.google_token_expiry).getTime() : 0
      if (expiry > Date.now() + 60000) return acct.google_access_token_enc
      if (acct.google_refresh_token_enc) {
        return await refreshToken(acct.google_refresh_token_enc)
      }
    }
  }
  return null
}

async function refreshToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    return data.access_token ?? null
  } catch { return null }
}

async function gmailModify(supabase: any, userId: string, email: any, removeLabels: string[], addLabels: string[]) {
  const token = await getGmailToken(supabase, userId, email)
  if (!token || !email.gmail_message_id) return
  try {
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.gmail_message_id}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: removeLabels, addLabelIds: addLabels }),
    })
  } catch {}
}

async function gmailTrash(supabase: any, userId: string, email: any) {
  const token = await getGmailToken(supabase, userId, email)
  if (!token || !email.gmail_message_id) return
  try {
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${email.gmail_message_id}/trash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {}
}
