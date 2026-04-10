/**
 * /api/exec/time — TSA™ Time Sovereignty Agent
 * Calendar audit, strategic block management, weekly time tracking
 * PIOS Sprint 23 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callClaude } from '@/lib/ai/client'

export const runtime    = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [blocksR, auditsR] = await Promise.all([
      supabase.from('exec_time_blocks').select('*').eq('user_id', user.id).order('start_time'),
      supabase.from('exec_time_audits').select('*').eq('user_id', user.id).order('week_start', { ascending: false }).limit(8),
    ])

    const blocks = (blocksR.data ?? []) as Record<string,unknown>[]
    const totalProtected = blocks.filter(b => b.protected).length

    const typeBreakdown = blocks.reduce((acc: Record<string,number>, b) => {
      const t = (b.block_type as string) ?? 'other'
      acc[t] = (acc[t] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      blocks: blocksR.data ?? [],
      audits: auditsR.data ?? [],
      summary: { total_blocks: blocks.length, protected_blocks: totalProtected, type_breakdown: typeBreakdown },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('tenant_id,full_name,job_title').eq('id', user.id).single()
    const prof = profile as Record<string,unknown> | null

    const body = await req.json()
    const { action } = body as { action: string }

    // ── Save time block ──────────────────────────────────────
    if (action === 'save_block') {
      const { payload } = body as { payload: Record<string,unknown> }
      const { data, error } = await supabase
        .from('exec_time_blocks')
        .insert({ ...payload, user_id: user.id, tenant_id: prof?.tenant_id ?? user.id })
        .select().single()
      if (error) throw new Error(error.message)
      return NextResponse.json({ data }, { status: 201 })
    }

    // ── Delete time block ────────────────────────────────────
    if (action === 'delete_block') {
      const { block_id } = body as { block_id: string }
      await supabase.from('exec_time_blocks').delete().eq('id', block_id).eq('user_id', user.id)
      return NextResponse.json({ ok: true })
    }

    // ── Submit weekly time audit ─────────────────────────────
    if (action === 'log_week') {
      const { week_start, strategic_hours, operational_hours, admin_hours, stakeholder_hours, recovery_hours } = body as {
        week_start: string; strategic_hours: number; operational_hours: number
        admin_hours: number; stakeholder_hours: number; recovery_hours: number
      }
      const total = strategic_hours + operational_hours + admin_hours + stakeholder_hours + recovery_hours

      const { data, error } = await supabase.from('exec_time_audits').insert({
        user_id: user.id, tenant_id: prof?.tenant_id ?? user.id,
        week_start, strategic_hours, operational_hours, admin_hours,
        stakeholder_hours, recovery_hours, total_hours: total,
      }).select().single()
      if (error) throw new Error(error.message)
      return NextResponse.json({ data }, { status: 201 })
    }

    // ── TSA AI audit ─────────────────────────────────────────
    if (action === 'ai_audit') {
      const { blocks, recent_audits } = body as {
        blocks: Record<string,unknown>[]
        recent_audits: Record<string,unknown>[]
      }

      const audit = await callClaude(
        [{ role: 'user', content: `Perform a Time Sovereignty Audit for this executive.

SCHEDULED TIME BLOCKS:
${JSON.stringify(blocks, null, 2)}

RECENT WEEKLY ACTUALS (last 8 weeks):
${JSON.stringify(recent_audits, null, 2)}

Deliver:

## TIME SOVEREIGNTY SCORE
Rate 1-10 how well this executive controls their time for strategic work. Justify in 2 sentences.

## STRATEGIC TIME RATIO
What % of scheduled time is protected for strategic/deep work? Is this sufficient? (Benchmark: senior executives should protect 30-40% for strategic work.)

## CALENDAR TRAPS IDENTIFIED
List the 2-3 specific patterns where busyness is replacing strategy. Be specific about which block types or time slots.

## MISSING BLOCKS
What recurring time blocks are absent that a high-performing executive should have? (e.g. weekly review, deep work mornings, stakeholder 1:1s, board prep)

## TOP 3 RECOMMENDATIONS
Concrete, specific changes ranked by impact. Include suggested time, frequency, and which existing blocks to protect or eliminate.

Keep the whole analysis under 400 words.` }],
        `You are TSA™ — the Time Sovereignty Agent inside PIOS. You help executives reclaim control of their calendar and ensure time allocation matches strategic priorities. You are direct and specific. You never name third-party frameworks or books.`,
        800
      )

      return NextResponse.json({ audit })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
