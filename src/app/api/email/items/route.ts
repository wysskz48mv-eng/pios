/**
 * /api/email/items — Email inbox items CRUD
 * GET    ?domain=&status=&min_priority=&limit=&inbox_context=
 * PATCH  { id, status, domain_tag, action_required }
 * DELETE ?id= — soft delete (set status=ignored)
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp           = req.nextUrl.searchParams
    const domain       = sp.get('domain')
    const status       = sp.get('status')
    const inboxContext = sp.get('inbox_context')
    const minPriority  = sp.get('min_priority')
    const limit        = Math.min(parseInt(sp.get('limit') ?? '50'), 200)

    let q = supabase.from('email_items')
      .select('id,subject,sender_name,sender_email,received_at,snippet,domain_tag,priority_score,action_required,ai_draft_reply,status,is_receipt,receipt_data,inbox_context,inbox_label,account_id')
      .eq('user_id', user.id)
      .not('status', 'eq', 'ignored')
      .order('received_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all')       q = q.eq('status', status)
    if (domain && domain !== 'all')       q = q.eq('domain_tag', domain)
    if (inboxContext && inboxContext !== 'all') q = q.eq('inbox_context', inboxContext)
    if (minPriority)                      q = q.gte('priority_score', parseInt(minPriority))

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Summary counts
    const emails = data ?? []
    const unread   = emails.filter(e => e.status === 'unprocessed' || e.status === 'triaged').length
    const receipts = emails.filter(e => e.is_receipt).length
    const highPri  = emails.filter(e => (e.priority_score ?? 0) >= 7).length
    const actionRequired = emails.filter(e => e.action_required).length

    return NextResponse.json({
      emails,
      count: emails.length,
      summary: { unread, receipts, high_priority: highPri, action_required: actionRequired },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const allowed = ['status','domain_tag','action_required','ai_draft_reply','task_created','task_id','processed_at']
    const safe: Record<string,unknown> = { updated_at: new Date().toISOString() }
    for (const k of allowed) { if (k in updates) safe[k] = updates[k] }
    if (updates.status === 'actioned' && !safe.processed_at) {
      safe.processed_at = new Date().toISOString()
    }

    const { data, error } = await supabase.from('email_items')
      .update(safe).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ email: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await supabase.from('email_items')
      .update({ status: 'ignored', updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id)

    return NextResponse.json({ ignored: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
