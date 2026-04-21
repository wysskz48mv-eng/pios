/**
 * /api/contracts — Contract Register CRUD + renewal alerts
 * PIOS Sprint 36 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

import { checkPromptSafety } from '@/lib/security-middleware'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    let q = supabase.from('contracts').select('*').eq('user_id', user.id).order('end_date', { ascending: true })
    if (status) q = (q as any).eq('status', status)
    const { data, error } = await q
    if (error) throw error

    const today = new Date().toISOString().slice(0, 10)
    const in60  = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
    const renewalAlerts = (data ?? []).filter((c: any) =>
      c.status === 'active' && c.end_date && c.end_date <= in60 && c.end_date >= today
    )
    const totalValue = (data ?? []).filter((c: any) => c.status === 'active').reduce((s: number, c: any) => s + (Number(c.value) || 0), 0)

    return NextResponse.json({ contracts: data ?? [], renewalAlerts, totalValue })
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: prof } = await supabase.from('user_profiles').select('tenant_id,full_name').eq('id', user.id).single()
    const p = prof as any

    const body = await req.json() as Record<string, unknown>
    const action = body.action as string

    if (action === 'create') {
      const { data, error } = await supabase.from('contracts').insert({
        user_id: user.id, tenant_id: p?.tenant_id ?? user.id,
        title: body.title, contract_type: body.contract_type,
        counterparty: body.counterparty, status: body.status ?? 'active',
        value: body.value ?? null, currency: body.currency ?? 'GBP',
        start_date: body.start_date ?? null, end_date: body.end_date ?? null,
        auto_renewal: body.auto_renewal ?? false,
        notice_period_days: body.notice_period_days ?? null,
        renewal_date: body.renewal_date ?? null,
        key_terms: body.key_terms ?? null, obligations: body.obligations ?? null,
        domain: body.domain ?? 'business', notes: body.notes ?? null,
      }).select().single()
      if (error) throw error
      return NextResponse.json({ contract: data })
    }
    if (action === 'update') {
      const { id, action: _a, ...fields } = body as any
      const { data, error } = await supabase.from('contracts').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select().single()
      if (error) throw error
      return NextResponse.json({ contract: data })
    }
    if (action === 'delete') {
      await supabase.from('contracts').delete().eq('id', body.id as string).eq('user_id', user.id)
      return NextResponse.json({ ok: true })
    }
    if (action === 'ai_review') {
      const { data: contracts } = await supabase.from('contracts').select('title,contract_type,counterparty,status,value,currency,end_date,auto_renewal,notice_period_days,key_terms,obligations').eq('user_id', user.id).eq('status', 'active')
      const list = (contracts ?? []).map((c: any) => `- ${c.title} (${c.contract_type}) with ${c.counterparty} — ${c.currency} ${c.value ?? 'TBC'} | Ends: ${c.end_date ?? 'open'} | Auto-renewal: ${c.auto_renewal ? 'Yes' : 'No'}`).join('\n')
      const review = await callClaude(
        [{ role: 'user', content: `You are reviewing the active contract register for ${p.full_name ?? 'a founder'}.\n\nActive contracts:\n${list}\n\nProvide a contract portfolio review:\n1. CONCENTRATION RISK — any over-reliance on a single counterparty or contract type?\n2. EXPIRY PIPELINE — contracts expiring in the next 90 days that need action\n3. RENEWAL RISKS — auto-renewals that may lock in unfavourable terms without review\n4. OBLIGATION GAPS — any obligations that appear under-resourced or at risk of breach\n5. RECOMMENDED ACTIONS — top 5 contract management actions for the next 30 days\n\nBe specific. Reference contract titles and counterparty names.` }],
        'You are a senior contracts and risk advisor. Provide concise, practical output in plain English.',
        1200,
        'sonnet'
      )
      return NextResponse.json({ review })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
