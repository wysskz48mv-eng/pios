import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { morningBriefHtml, morningBriefText, sendEmail, type BriefData } from '@/lib/email'

/**
 * POST /api/cron/morning-brief
 * Vercel Cron — fires at 06:00 UTC daily (07:00 BST / 09:00 AST).
 * 
 * For each active PIOS user:
 *   1. Gather context: tasks, OKRs, decisions, wellness, financial snapshot
 *   2. Generate brief with Claude (skip if one already exists today)
 *   3. Persist to morning_briefs table
 *   4. Send branded HTML email via Resend
 * 
 * Protected by CRON_SECRET (Authorization: Bearer header).
 * Returns 200 always — logs errors per user, never fails entire batch.
 * 
 * VeritasIQ Technologies Ltd · Sprint I
 */

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 300

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('Authorization') ?? ''
  return auth === `Bearer ${secret}`
}

function adminDb() {
  return createClient(SUPABASE_URL, SERVICE_KEY)
}

async function callClaude(prompt: string, system: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message ?? 'Claude API error')
  return data?.content?.[0]?.text ?? ''
}

async function gatherContext(supabase: ReturnType<typeof adminDb>, userId: string) {
  const today     = new Date()
  const todayStr  = today.toISOString().split('T')[0]
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const [tasksRes, okrsRes, decisionsRes, wellnessRes, financialRes, calibRes] = await Promise.allSettled([
    supabase.from('tasks').select('id,title,priority,status,due_date').eq('user_id', userId).neq('status', 'done').order('priority', { ascending: false }).limit(20),
    supabase.from('okrs').select('id,title,progress_pct,health,period').eq('user_id', userId).order('created_at', { ascending: false }).limit(8),
    supabase.from('decisions').select('id,title,status,created_at').eq('user_id', userId).eq('status', 'open').limit(6),
    supabase.from('wellness_streaks').select('current_streak,last_activity_date').eq('user_id', userId).single(),
    supabase.from('financial_snapshots').select('revenue_gbp,burn_gbp,runway_months,period').eq('user_id', userId).order('period', { ascending: false }).limit(1).single(),
    supabase.from('nemoclaw_calibration').select('recommended_frameworks,communication_register,calibration_summary').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(),
  ])

  const tasks     = tasksRes.status     === 'fulfilled' ? (tasksRes.value.data     ?? []) : []
  const okrs      = okrsRes.status      === 'fulfilled' ? (okrsRes.value.data      ?? []) : []
  const decisions = decisionsRes.status === 'fulfilled' ? (decisionsRes.value.data ?? []) : []
  const wellness  = wellnessRes.status  === 'fulfilled' ? wellnessRes.value.data   : null
  const financial = financialRes.status === 'fulfilled' ? financialRes.value.data  : null
  const calib     = calibRes.status     === 'fulfilled' ? calibRes.value.data      : null

  // Mark overdue tasks
  const enrichedTasks = tasks.map((t: Record<string, unknown>) => ({
    ...t,
    overdue: t.due_date ? new Date(String(t.due_date ?? '')) < today : false,
  }))

  return { tasks: enrichedTasks, okrs, decisions, wellness, financial, calib, todayStr }
}

function buildPrompt(ctx: Awaited<ReturnType<typeof gatherContext>>, userName: string): string {
  const { tasks, okrs, decisions, wellness, financial, calib } = ctx

  const highTasks   = tasks.filter((t: Record<string, unknown>) => t.priority === 'high' || t.overdue)
  const overdueList = tasks.filter((t: Record<string, unknown>) => t.overdue)
  const atRiskOkrs  = okrs.filter((o: Record<string, unknown>) => ['at_risk', 'off_track'].includes(String(o.health ?? '')))

  return `Morning brief for ${userName}. Today: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.

${calib?.calibration_summary ? `USER PROFILE: ${calib.calibration_summary.slice(0, 200)}` : ''}

TASKS (${tasks.length} open):
${highTasks.slice(0, 6).map((t: Record<string, unknown>) => `- [${String(t.priority ?? '').toUpperCase()}${t.overdue ? ' OVERDUE' : ''}] ${String(t.title ?? '')}${t.due_date ? ` (due ${new Date(String(t.due_date ?? '')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})` : ''}`).join('\n') || 'None'}
${overdueList.length > 0 ? `OVERDUE COUNT: ${overdueList.length}` : ''}

OKRs (${okrs.length}):
${okrs.slice(0, 4).map((o: Record<string, unknown>) => `- ${String(o.title ?? '')} [${String(o.progress_pct ?? 0)}% — ${String(o.health ?? '')}]`).join('\n') || 'None'}
${atRiskOkrs.length > 0 ? `AT RISK: ${atRiskOkrs.length} OKRs need attention` : ''}

OPEN DECISIONS: ${decisions.length}
${decisions.slice(0, 3).map((d: Record<string, unknown>) => `- ${String(d.title ?? '')}`).join('\n') || 'None'}

${financial ? `FINANCIAL: Revenue ${financial.revenue_gbp ? `£${(financial.revenue_gbp / 1000).toFixed(0)}k` : 'unknown'} · Burn ${financial.burn_gbp ? `£${(financial.burn_gbp / 1000).toFixed(0)}k/mo` : 'unknown'} · Runway ${financial.runway_months ?? '?'} months` : ''}
${wellness ? `WELLNESS: ${wellness.current_streak ?? 0}-day streak` : ''}

Generate a tight morning brief: 3 focused paragraphs, max 220 words. Para 1: single most important priority today. Para 2: cross-domain risks or conflicts requiring attention. Para 3: 2–3 specific actions to take. Direct, no fluff. Address ${userName.split(' ')[0]} directly.`
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const db      = adminDb()
  const today   = new Date().toISOString().split('T')[0]
  const results: Array<{ userId: string; status: string; email?: string }> = []

  try {
    // Get all users with brief delivery enabled (or all users if column missing)
    const { data: profiles, error: profilesErr } = await db
      .from('user_profiles')
      .select('id, full_name, brief_enabled, billing_status')
      .or('brief_enabled.is.null,brief_enabled.eq.true')
      .limit(500)

    if (profilesErr) throw profilesErr
    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ ok: true, message: 'No users to brief', date: today })
    }

    // Get emails from auth.users
    const userIds = profiles.map((p: Record<string, string>) => p.id)
    const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 500 })
    const emailMap = new Map(
      (authUsers?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? ''])
    )

    // Skip users who already have a brief today
    const { data: existing } = await db
      .from('morning_briefs')
      .select('user_id')
      .eq('brief_date', today)
      .in('user_id', userIds)

    const alreadyBriefed = new Set((existing ?? []).map((r: Record<string, string>) => r.user_id))

    for (const profile of profiles as Array<{ id: string; full_name?: string }>) {
      if (alreadyBriefed.has(profile.id)) {
        results.push({ userId: profile.id, status: 'skipped_cached' })
        continue
      }

      try {
        const ctx       = await gatherContext(db, profile.id)
        const userName  = profile.full_name ?? 'there'
        const prompt    = buildPrompt(ctx, userName)

        const system = `You are NemoClaw™, the personal AI intelligence layer for a founder/CEO/consultant using PIOS.
Write concise, direct morning briefs — no corporate fluff, no bullet points in the main text.
Use plain prose paragraphs. Be specific and actionable. Max 220 words total.`

        const summary = await callClaude(prompt, system)

        // Persist brief
        await db.from('morning_briefs').upsert({
          user_id:    profile.id,
          brief_date: today,
          summary_text: summary,
          generated_by: 'cron',
          created_at:   new Date().toISOString(),
        }, { onConflict: 'user_id,brief_date' })

        // Send email
        const userEmail = emailMap.get(profile.id)
        if (userEmail) {
          const briefData: BriefData = {
            userName,
            briefDate:  today,
            summary,
            tasks:      ctx.tasks as BriefData['tasks'],
            okrs:       (ctx.okrs as Array<{ title: string; progress_pct: number; health: string }>).map(o => ({
              title:    o.title,
              progress: o.progress_pct,
              health:   o.health,
            })),
            decisions:  ctx.decisions as BriefData['decisions'],
            wellness:   ctx.wellness ? {
              mood:   0,  // wellness_streaks table doesn't store today's mood — placeholder
              streak: ctx.wellness.current_streak ?? 0,
            } : null,
            financial: ctx.financial ? {
              revenue: ctx.financial.revenue_gbp,
              burn:    ctx.financial.burn_gbp,
              runway:  ctx.financial.runway_months,
            } : null,
            frameworks: ctx.calib?.recommended_frameworks?.slice(0, 5) ?? [],
          }

          const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
          await sendEmail({
            to:      userEmail,
            subject: `Your PIOS Brief — ${dateLabel}`,
            html:    morningBriefHtml(briefData),
            text:    morningBriefText(briefData),
          })
        }

        results.push({ userId: profile.id, status: 'ok', email: userEmail })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message.slice(0, 120) : String(err)
        console.error(`[cron/morning-brief] user ${profile.id}:`, msg)
        results.push({ userId: profile.id, status: `error: ${msg}` })
      }
    }

    const ok      = results.filter(r => r.status === 'ok').length
    const skipped = results.filter(r => r.status.startsWith('skipped')).length
    const errors  = results.filter(r => r.status.startsWith('error')).length

    console.log(`[cron/morning-brief] ${today}: ok=${ok} skipped=${skipped} errors=${errors}`)

    return NextResponse.json({ ok: true, date: today, generated: ok, skipped, errors, total: profiles.length })
  } catch (err: unknown) {
    console.error('[cron/morning-brief] Fatal:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Cron failed' },
      { status: 500 }
    )
  }
}
