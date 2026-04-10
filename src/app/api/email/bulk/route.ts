/**
 * POST /api/email/bulk
 * Apply actions to multiple emails at once.
 *
 * Body: { email_ids: string[], action: string }
 * Actions: archive, delete, spam, mark_read, mark_unread, flag, unflag
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'

const BULK_ACTIONS: Record<string, Record<string, unknown>> = {
  archive:     { status: 'archived' },
  delete:      { status: 'deleted' },
  spam:        { status: 'spam', is_spam: true },
  mark_read:   { status: 'read' },
  mark_unread: { status: 'triaged' },
  flag:        { is_flagged: true },
  unflag:      { is_flagged: false },
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email_ids, action } = await req.json() as { email_ids: string[]; action: string }

    if (!email_ids?.length) return NextResponse.json({ error: 'email_ids required' }, { status: 400 })
    if (email_ids.length > 100) return NextResponse.json({ error: 'Max 100 emails per batch' }, { status: 400 })

    const updates = BULK_ACTIONS[action]
    if (!updates) return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })

    const { error, count } = await supabase
      .from('email_items')
      .update(updates)
      .eq('user_id', user.id)
      .in('id', email_ids)

    if (error) return NextResponse.json({ error: 'Bulk action failed' }, { status: 400 })

    // Log each action
    const logs = email_ids.map(id => ({
      user_id: user.id,
      email_item_id: id,
      action,
    }))
    await supabase.from('email_actions').insert(logs)

    return NextResponse.json({ ok: true, action, affected: email_ids.length })
  } catch (err) { return apiError(err) }
}
