/**
 * GET /api/email/search?q=&from=&has=&is=&date=&saved_id=
 * POST /api/email/search — save/delete a search
 *
 * Search syntax:
 *   q=invoice              — full text (subject + snippet)
 *   from=sender@email.com  — sender email contains
 *   has=attachment          — (future: attachment filter)
 *   is=unread,flagged,spam  — status filters (comma-separated)
 *   date=7d                — last 7 days (or 30d, 90d)
 *   domain=academic        — domain tag filter
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const p = req.nextUrl.searchParams
    const q      = p.get('q')?.trim().slice(0, 200) ?? ''
    const from   = p.get('from')?.trim() ?? ''
    const is     = p.get('is')?.split(',').filter(Boolean) ?? []
    const date   = p.get('date') ?? ''
    const domain = p.get('domain') ?? ''
    const limit  = Math.min(parseInt(p.get('limit') ?? '50'), 100)

    let query = supabase
      .from('email_items')
      .select('*')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(limit)

    // Full text search (subject + snippet)
    if (q) {
      const ilike = `%${q}%`
      query = query.or(`subject.ilike.${ilike},snippet.ilike.${ilike}`)
    }

    // From filter
    if (from) {
      query = query.ilike('sender_email', `%${from}%`)
    }

    // Status filters
    if (is.includes('unread'))  query = query.in('status', ['triaged', 'unprocessed'])
    if (is.includes('flagged')) query = query.eq('is_flagged', true)
    if (is.includes('spam'))    query = query.eq('is_spam', true)
    if (is.includes('snoozed')) query = query.eq('is_snoozed', true)
    if (is.includes('archived')) query = query.eq('status', 'archived')
    if (is.includes('blocked')) query = query.eq('is_blocked', true)

    // Date filter
    if (date) {
      const days = parseInt(date.replace('d', ''))
      if (!isNaN(days) && days > 0) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('received_at', since)
      }
    }

    // Domain filter
    if (domain) {
      query = query.eq('domain_tag', domain)
    }

    // Exclude spam/deleted by default unless explicitly searching for them
    if (!is.includes('spam') && !is.includes('blocked')) {
      query = query.not('status', 'eq', 'spam')
    }
    if (!is.includes('deleted')) {
      query = query.not('status', 'eq', 'deleted')
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Search failed' }, { status: 400 })

    return NextResponse.json({
      results: data ?? [],
      total: data?.length ?? 0,
      query: { q, from, is, date, domain },
    })
  } catch (err) { return apiError(err) }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    if (action === 'save') {
      const { name, query } = body
      if (!name || !query) return NextResponse.json({ error: 'name and query required' }, { status: 400 })

      const { data } = await supabase.from('email_saved_searches').insert({
        user_id: user.id,
        name,
        query,
      }).select().single()

      return NextResponse.json({ saved_search: data }, { status: 201 })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      await supabase.from('email_saved_searches').delete().eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true })
    }

    if (action === 'list') {
      const { data } = await supabase
        .from('email_saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      return NextResponse.json({ saved_searches: data ?? [] })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) { return apiError(err) }
}
