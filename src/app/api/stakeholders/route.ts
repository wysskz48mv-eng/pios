/**
 * /api/stakeholders — Stakeholder CRM
 * GET: list · POST: create · PATCH: update · DELETE: soft-delete
 * PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CATEGORIES  = ['investor','client','partner','academic','government','media','advisor','supplier','internal']
const HEALTH      = ['strong','good','neutral','at_risk','dormant']

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const health   = searchParams.get('health')

    let q = supabase.from('exec_stakeholders')
      .select('*').eq('user_id', user.id)
      .order('importance').order('name')

    if (category && category !== 'all') q = q.eq('category', category)
    if (health   && health   !== 'all') q = q.eq('relationship_status', health)

    const { data } = await q

    // Compute follow-up overdue
    const today = new Date().toISOString().slice(0, 10)
    const stakeholders = (data ?? []).map((s: any) => ({
      ...s,
      overdue: s.next_touchpoint && s.next_touchpoint < today,
    }))

    return NextResponse.json({ stakeholders, total: stakeholders.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    // ── AI briefing ────────────────────────────────────────────────────
    if (action === 'ai_briefing') {
      const { stakeholder } = body
      const system = `You are preparing a meeting briefing for Douglas Masuku, Group CEO of VeritasIQ Technologies Ltd, for a meeting with a key stakeholder. Be concise and actionable.`
      const prompt = `Prepare a pre-meeting briefing for:
Name: ${stakeholder.name}
Organisation: ${stakeholder.organisation ?? 'unknown'}
Category: ${stakeholder.category}
Relationship: ${stakeholder.relationship_status}
Notes: ${stakeholder.notes ?? 'none'}
Last contact: ${stakeholder.last_contact_date ?? 'unknown'}

Return ONLY valid JSON:
{
  "opening": "How to open the conversation",
  "key_objectives": ["What to achieve in this meeting"],
  "talking_points": ["3-4 specific things to discuss"],
  "risks": "Any relationship risks to be aware of",
  "ask": "The specific ask or outcome to drive toward"
}`
      const raw = await callClaude([{ role: 'user', content: prompt }], system, 600)
      try {
        const parsed = JSON.parse(raw.replace(/```json\n?|```/g, '').trim())
        return NextResponse.json({ briefing: parsed })
      } catch {
        return NextResponse.json({ briefing: { opening: raw } })
      }
    }

    // ── Create stakeholder ─────────────────────────────────────────────
    const { data: prof } = await supabase.from('user_profiles')
      .select('tenant_id').eq('id', user.id).single()
    const tenant_id = (prof as any)?.tenant_id
    if (!tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const { name, organisation, category, importance = 3, relationship_status = 'neutral',
            notes, next_touchpoint, linkedin_url } = body

    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
    if (!CATEGORIES.includes(category)) return NextResponse.json({ error: 'invalid category' }, { status: 400 })

    const { data, error } = await supabase.from('exec_stakeholders').insert({
      tenant_id, user_id: user.id,
      name: name.trim(), organisation, category,
      importance: Math.max(1, Math.min(5, importance)),
      relationship_status: HEALTH.includes(relationship_status) ? relationship_status : 'neutral',
      notes, next_touchpoint, linkedin_url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ stakeholder: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const ALLOWED = ['name','organisation','category','importance','relationship_status',
                     'notes','next_touchpoint','last_contact_date','linkedin_url']
    const safe: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of ALLOWED) { if (k in body) safe[k] = body[k] }

    if (safe.relationship_status && !HEALTH.includes(safe.relationship_status as string))
      return NextResponse.json({ error: 'invalid relationship_status' }, { status: 400 })
    if (safe.importance) safe.importance = Math.max(1, Math.min(5, Number(safe.importance)))

    const { data, error } = await supabase.from('exec_stakeholders')
      .update(safe).eq('id', id).eq('user_id', user.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ stakeholder: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await supabase.from('exec_stakeholders').delete().eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ deleted: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
