/**
 * /api/ip-vault — IP Vault CRUD + AI protection brief
 * PIOS Sprint 36 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

import { checkPromptSafety } from '@/lib/security-middleware'

export const runtime    = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    let q = supabase.from('ip_assets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (type) q = (q as any).eq('asset_type', type)
    const { data, error } = await q
    if (error) throw error

    const today = new Date().toISOString().slice(0, 10)
    const in90  = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
    const renewalAlerts = (data ?? []).filter((a: any) => a.renewal_date && a.renewal_date <= in90 && a.renewal_date >= today && a.status === 'active')

    return NextResponse.json({ assets: data ?? [], renewalAlerts })
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: prof } = await supabase.from('user_profiles').select('tenant_id,full_name,organisation').eq('id', user.id).single()
    const p = prof as any
    if (!p?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await req.json() as Record<string, unknown>
    const action = body.action as string

    if (action === 'create') {
      const { data, error } = await supabase.from('ip_assets').insert({
        user_id: user.id, tenant_id: p.tenant_id,
        name: body.name, asset_type: body.asset_type,
        description: body.description ?? null, status: body.status ?? 'active',
        jurisdiction: body.jurisdiction ?? [], filing_date: body.filing_date ?? null,
        registration_no: body.registration_no ?? null, renewal_date: body.renewal_date ?? null,
        owner_entity: body.owner_entity ?? 'VeritasIQ Technologies Ltd',
        notes: body.notes ?? null, tags: body.tags ?? [],
      }).select().single()
      if (error) throw error
      return NextResponse.json({ asset: data })
    }
    if (action === 'update') {
      const { id, action: _a, ...fields } = body as any
      const { data, error } = await supabase.from('ip_assets').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id).select().single()
      if (error) throw error
      return NextResponse.json({ asset: data })
    }
    if (action === 'delete') {
      await supabase.from('ip_assets').delete().eq('id', body.id as string).eq('user_id', user.id)
      return NextResponse.json({ ok: true })
    }
    if (action === 'ai_brief') {
      const { data: assets } = await supabase.from('ip_assets').select('name,asset_type,status,jurisdiction,renewal_date,owner_entity').eq('user_id', user.id)
      const assetList = (assets ?? []).map((a: any) => `- ${a.name} (${a.asset_type}) — ${a.status} | ${(a.jurisdiction ?? []).join(', ') || 'Jurisdiction TBD'}`).join('\n')
      const brief = await callClaude([{ role: 'user', content: `You are a senior IP strategist advising ${p.full_name ?? 'a founder'} at ${p.organisation ?? 'a technology company'}.\n\nIP portfolio:\n${assetList}\n\nProvide a concise IP brief:\n1. PORTFOLIO STRENGTH — assess breadth and quality of protection\n2. GAPS & VULNERABILITIES — what is unprotected that competitors could exploit?\n3. RENEWAL PRIORITIES — urgent filings or renewals needed\n4. STRATEGIC RECOMMENDATIONS — 3 specific actions to strengthen IP in the next 90 days\n5. MONETISATION — any IP with licensing potential not yet exploited\n\nBe specific. Cite asset names. No generic advice.` }], 'claude-sonnet-4-20250514', 0.3)
      return NextResponse.json({ brief })
    }

    if (action === 'seed_frameworks') {
      // Check none already seeded for this user
      const { data: existing } = await supabase.from('ip_assets')
        .select('name').eq('user_id', user.id).eq('asset_type', 'framework')
      const existingNames = new Set((existing ?? []).map((a: any) => a.name))

      const frameworks = [
        { name: 'SDL™ — Structured Decomposition Logic', desc: 'Breaks complex problems into exhaustive, non-overlapping layers. The zero-IP-risk foundation of all analytical work.' },
        { name: 'POM™ — Portfolio Opportunity Matrix', desc: 'Maps business lines on growth potential × competitive strength axes. Replaces BCG Growth-Share.' },
        { name: 'OAE™ — Organisational Alignment Engine', desc: 'Seven-dimension org health assessment — strategy, structure, systems, shared values, staff, skills, style.' },
        { name: 'CVDM™ — Customer Value Driver Map', desc: 'Maps what customers actually value vs what they pay for. Pricing and positioning intelligence.' },
        { name: 'CPA™ — Competitive Position Analyser', desc: 'Analyses market structure: entrants, substitutes, buyer/supplier power, rivalry. Replaces Porter Five Forces.' },
        { name: 'UMS™ — Uncontested Market Scout', desc: 'Identifies whitespace by mapping value curves vs competitors. Replaces Blue Ocean Strategy.' },
        { name: 'VFO™ — Value Flow Optimiser', desc: 'Eliminates waste by mapping value-adding vs non-value-adding steps. Replaces Lean/DMAIC.' },
        { name: 'CFE™ — Constraint & Flow Engine', desc: 'Finds the single biggest constraint limiting system throughput. Replaces Theory of Constraints.' },
        { name: 'ADF™ — Adaptive Delivery Framework', desc: 'Sprint-based execution layer for project delivery. Replaces Agile/Kanban.' },
        { name: 'GSM™ — Geo-Strategic Monitor', desc: 'Scans geopolitical, regulatory, and macro signals across six dimensions. Replaces PESTLE+GRI.' },
        { name: 'SPA™ — Stakeholder Power Atlas', desc: 'Maps stakeholders on influence × interest axes. Replaces Power-Interest Grid.' },
        { name: 'RTE™ — Risk-Tiered Escalation', desc: 'Classifies risks by probability × impact, routes to correct decision tier. Replaces Risk Matrix/COSO.' },
        { name: 'IML™ — Institutional Memory Layer', desc: 'Compounds learning across engagements via case repository intelligence. Replaces PKM/Knowledge Mgmt.' },
        { name: 'SCE™ — Strategic Context Engine', desc: 'Scans macro environment across socio-cultural, tech, economic, environmental, political dimensions.' },
        { name: 'AAM™ — Accountability Architecture', desc: 'Maps decision rights — Accountable, Responsible, Consulted, Informed — across all key decisions.' },
      ]

      const toInsert = frameworks
        .filter(fw => !existingNames.has(fw.name))
        .map(fw => ({
          user_id: user.id, tenant_id: p.tenant_id,
          name: fw.name, asset_type: 'framework',
          description: fw.desc, status: 'active',
          owner_entity: 'VeritasIQ Technologies Ltd',
          jurisdiction: ['UK', 'UAE'],
          tags: ['NemoClaw', 'proprietary', 'consulting'],
        }))

      if (toInsert.length > 0) {
        const { error } = await supabase.from('ip_assets').insert(toInsert)
        if (error) throw error
      }

      return NextResponse.json({ seeded: toInsert.length, skipped: frameworks.length - toInsert.length })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }) }
}
