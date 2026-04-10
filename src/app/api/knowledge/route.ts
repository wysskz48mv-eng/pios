import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ entries: [] })

    const url      = new URL(req.url)
    const category = url.searchParams.get('category')
    const search   = url.searchParams.get('search')

    let q = supabase.from('knowledge_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (category) q = q.eq('category', category)
    if (search)   q = q.or(`title.ilike.%${search}%,content.ilike.%${search}%`)

    const { data } = await q.limit(100)
    return NextResponse.json({ entries: data ?? [] })
  } catch {
    return NextResponse.json({ entries: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json()
    const { title, content, category, source, tags } = body

    if (!title || !content) return NextResponse.json({ error: 'title and content required' }, { status: 400 })

    // Auto-generate tags via simple keyword extraction if none provided
    const autoTags = tags ?? extractKeywords(content)

    const { data, error } = await supabase
      .from('knowledge_entries')
      .insert({
        user_id:    user.id,
        title,
        content,
        category:   category ?? 'insight',
        source:     source ?? null,
        tags:       autoTags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    return NextResponse.json({ entry: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const url = new URL(req.url)
    const id  = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const { data, error } = await supabase
      .from('knowledge_entries')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', user.id)
      .select().single()

    if (error) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    return NextResponse.json({ entry: data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const url = new URL(req.url)
    const id  = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await supabase.from('knowledge_entries').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Simple keyword extractor — pulls capitalised and domain-specific words
function extractKeywords(text: string): string[] {
  const stops = new Set(['the','and','for','with','this','that','from','have','been','will','into','they','their','about','which','when','your','more','also','than','then','some','what','time'])
  return Array.from(new Set(
    text.split(/\W+/)
      .filter(w => w.length > 4 && !stops.has(w.toLowerCase()))
      .map(w => w.toLowerCase())
      .slice(0, 8)
  ))
}
