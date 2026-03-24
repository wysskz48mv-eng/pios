/**
 * GET /api/cron/okr-digest
 * Vercel Cron — Monday 07:00 UTC
 * Sends weekly OKR pulse email to executive-persona users.
 * PIOS Sprint 25 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/ai/client'
import { sendEmail } from '@/lib/email/resend'

export const runtime     = 'nodejs'
export const dynamic     = 'force-dynamic'
export const maxDuration = 300

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && req.headers.get('authorization') === `Bearer ${secret}`
}

function healthColor(h: string) {
  return h === 'on_track' ? '#4ade80' : h === 'at_risk' ? '#fbbf24' : '#f87171'
}
function healthLabel(h: string) {
  return h === 'on_track' ? 'On Track' : h === 'at_risk' ? 'At Risk' : 'Off Track'
}

function buildHtml(name: string, okrs: Record<string,unknown>[], commentary: string, weekLabel: string, appUrl: string): string {
  const first = name.split(' ')[0] ?? 'Executive'

  const rows = okrs.length ? okrs.map(o => {
    const p = (o.progress as number) ?? 0
    const h = (o.health as string) ?? 'on_track'
    const krs = (o.exec_key_results as Record<string,unknown>[]) ?? []
    const krHtml = krs.map(kr =>
      `<tr><td style="padding:4px 0 4px 14px;font-size:12px;color:#6b7280;border-left:2px solid rgba(255,255,255,0.08);">
        ${kr.title} — ${kr.current}/${kr.target}${kr.unit ? ' ' + kr.unit : ''}
        <span style="margin-left:6px;color:${healthColor((kr.status as string) ?? 'on_track')};font-size:11px;">${healthLabel((kr.status as string) ?? 'on_track')}</span>
      </td></tr>`
    ).join('')

    return `<tr><td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <table width="100%"><tr>
        <td><span style="font-size:15px;font-weight:600;color:#fff;">${o.title}</span></td>
        <td align="right">
          <span style="font-size:13px;font-weight:700;color:${healthColor(h)}">${p}%</span>
          <span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.07);color:${healthColor(h)}">${healthLabel(h)}</span>
        </td>
      </tr></table>
      <table style="margin-top:8px;width:100%;"><tr><td style="background:rgba(255,255,255,0.07);border-radius:4px;height:4px;padding:0;">
        <div style="background:${healthColor(h)};height:4px;border-radius:4px;width:${Math.min(100, p)}%;"></div>
      </td></tr></table>
      ${krs.length ? `<table style="margin-top:8px;width:100%;">${krHtml}</table>` : ''}
    </td></tr>`
  }).join('') : `<tr><td style="padding:14px 0;color:#6b7280;text-align:center;">No active OKRs.</td></tr>`

  const commentaryHtml = commentary.split('\n\n').filter(Boolean)
    .map(p => `<p style="margin:0 0 12px;line-height:1.7;color:#c8cedd;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0b0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b0d;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#111318;border-radius:12px 12px 0 0;padding:28px 36px;border-bottom:1px solid rgba(255,255,255,0.06);">
    <table width="100%"><tr>
      <td><span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#454d63;font-weight:600;">PIOS · PAA™</span><br/>
        <span style="font-size:22px;font-weight:700;color:#fff;">OKR Weekly Pulse</span></td>
      <td align="right"><span style="font-size:12px;color:#454d63;">${weekLabel}</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#111318;padding:20px 36px 0;"><p style="margin:0;font-size:15px;color:#c8cedd;">Hi ${first},</p></td></tr>
  <tr><td style="background:#111318;padding:16px 36px;"><table width="100%">${rows}</table></td></tr>
  <tr><td style="background:#0f1117;border-top:1px solid rgba(255,255,255,0.06);padding:24px 36px;">
    <p style="margin:0 0 12px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#a78bfa;font-weight:600;">PAA™ Intelligence</p>
    ${commentaryHtml}
  </td></tr>
  <tr><td style="background:#111318;padding:24px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
    <a href="${appUrl}/platform/executive" style="display:inline-block;background:#a78bfa;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">Open Executive OS →</a>
  </td></tr>
  <tr><td style="padding:20px 36px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#454d63;">PIOS · VeritasIQ Technologies Ltd · <a href="${appUrl}/platform/settings" style="color:#454d63;">Manage notifications</a></p>
  </td></tr>
</table></td></tr></table>
</body></html>`
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase  = createClient(SUPABASE_URL, SERVICE_KEY)
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios.veritasiq.tech'
  const weekLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  let sent = 0, skipped = 0, errors = 0

  // Target: exec-persona users + explicit prefs
  const [prefsR, execR] = await Promise.all([
    supabase.from('okr_notification_prefs').select('user_id,email_address').eq('weekly_digest', true),
    supabase.from('user_profiles').select('id,full_name').in('persona_type', ['executive','founder','professional']),
  ])

  const prefIds   = new Set(((prefsR.data ?? []) as Record<string,unknown>[]).map(p => p.user_id as string))
  const targets   = [
    ...((prefsR.data ?? []) as Record<string,unknown>[]).map(p => ({ user_id: p.user_id as string, email_override: p.email_address as string | null })),
    ...((execR.data ?? []) as Record<string,unknown>[])
      .filter(u => !prefIds.has(u.id as string))
      .map(u => ({ user_id: u.id as string, email_override: null })),
  ]

  for (const target of targets) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(target.user_id)
      const email = target.email_override ?? authUser?.user?.email
      if (!email) { skipped++; continue }

      const { data: prof } = await supabase
        .from('user_profiles').select('full_name').eq('id', target.user_id).single()
      const name = (prof as Record<string,unknown> | null)?.full_name as string ?? email

      const { data: okrs } = await supabase
        .from('exec_okrs')
        .select('title,health,progress,period,exec_key_results(title,current,target,unit,status)')
        .eq('user_id', target.user_id).eq('status', 'active')

      if (!okrs?.length) { skipped++; continue }

      const commentary = await callClaude(
        [{ role: 'user', content: `Weekly OKR review for ${name}:\n\n${(okrs as Record<string,unknown>[]).map(o => `- ${o.title}: ${o.progress}% (${o.health})`).join('\n')}\n\nWrite 3 short paragraphs: (1) overall portfolio health, (2) specific drift warning if any objective is at_risk or off_track, (3) the single most important action this week. Under 100 words total. Be direct and specific.` }],
        `You are PAA™ — Performance Accountability Agent inside PIOS. Write sharp weekly OKR commentary for executives. Reference their OKRs by name. No filler.`,
        250
      )

      const result = await sendEmail({
        to:      email,
        subject: `OKR Pulse — ${weekLabel} · PAA™`,
        html:    buildHtml(name, okrs as Record<string,unknown>[], commentary, weekLabel, appUrl),
        text:    `OKR Weekly Pulse — ${weekLabel}\n\n${commentary}`,
      })

      if (result.ok) {
        sent++
        await supabase.from('okr_notification_prefs')
          .upsert({ user_id: target.user_id, weekly_digest: true, last_sent_at: new Date().toISOString() }, { onConflict: 'user_id' })
      } else { errors++ }
    } catch (e: unknown) {
      console.error('[okr-digest]', e instanceof Error ? e.message : e)
      errors++
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, errors, week: weekLabel })
}
