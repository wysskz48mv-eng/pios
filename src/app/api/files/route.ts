import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/files?type=spaces|items|invoices|rules
// POST /api/files { action, ...payload }
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') ?? 'spaces'

    if (type === 'spaces') {
      const { data } = await supabase.from('file_spaces')
        .select('*').eq('user_id', user.id).order('sort_order')
      return NextResponse.json({ spaces: data ?? [] })
    }

    if (type === 'items') {
      const spaceId = searchParams.get('space_id')
      const status  = searchParams.get('status')
      let q = supabase.from('file_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
      if (spaceId) q = q.eq('space_id', spaceId)
      if (status)  q = q.eq('filing_status', status)
      const { data } = await q
      return NextResponse.json({ items: data ?? [] })
    }

    if (type === 'invoices') {
      const status = searchParams.get('status')
      let q = supabase.from('invoices').select('*, file_items(name, drive_web_url), email_items(subject, sender_name)').eq('user_id', user.id).order('invoice_date', { ascending: false })
      if (status && status !== 'all') q = q.eq('status', status)
      const { data } = await q
      return NextResponse.json({ invoices: data ?? [] })
    }

    if (type === 'rules') {
      const { data } = await supabase.from('filing_rules')
        .select('*').eq('user_id', user.id).order('priority')
      return NextResponse.json({ rules: data ?? [] })
    }

    if (type === 'stats') {
      const [spacesR, itemsR, invoicesR, pendingR] = await Promise.all([
        supabase.from('file_spaces').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('file_items').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('invoices').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase.from('invoices').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'pending'),
      ])
      return NextResponse.json({
        spaces: spacesR.count ?? 0,
        files: itemsR.count ?? 0,
        invoices: invoicesR.count ?? 0,
        invoicesPending: pendingR.count ?? 0,
      })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    // Create space
    if (action === 'create_space') {
      const { name, path, space_type, parent_id, icon, colour } = body
      const { data } = await supabase.from('file_spaces').insert({
        user_id: user.id, name, path, space_type: space_type ?? 'folder',
        parent_id: parent_id ?? null, icon: icon ?? '📁', colour: colour ?? '#6c8eff',
      }).select('id').single()
      return NextResponse.json({ created: true, id: data?.id })
    }

    // Update invoice status
    if (action === 'update_invoice') {
      const { id, ...updates } = body
      delete updates.action
      await supabase.from('invoices').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ updated: true })
    }

    // File an item to a space
    if (action === 'file_item') {
      const { item_id, space_id } = body
      await supabase.from('file_items').update({ space_id, filing_status: 'filed', updated_at: new Date().toISOString() }).eq('id', item_id).eq('user_id', user.id)
      return NextResponse.json({ filed: true })
    }

    // Save a filing rule
    if (action === 'save_rule') {
      const { rule } = body
      if (rule.id) {
        await supabase.from('filing_rules').update({ ...rule, updated_at: new Date().toISOString() }).eq('id', rule.id).eq('user_id', user.id)
        return NextResponse.json({ saved: true })
      }
      const { data } = await supabase.from('filing_rules').insert({ ...rule, user_id: user.id }).select('id').single()
      return NextResponse.json({ saved: true, id: data?.id })
    }

    // Delete rule
    if (action === 'delete_rule') {
      await supabase.from('filing_rules').delete().eq('id', body.id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
