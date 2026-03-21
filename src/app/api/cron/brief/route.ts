/**
 * GET /api/cron/brief
 * Vercel Cron Job — runs daily at 06:00 UTC (08:00 UAE / 07:00 UK)
 * Generates and caches morning briefs for all active PIOS users
 * who have auto_brief enabled (default: true) in their feed settings.
 *
 * Called by Vercel Cron — protected by CRON_SECRET header.
 * User-initiated brief generation still goes through POST /api/brief.
 *
 * PIOS v1.0 | Sustain International FZE Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callClaude } from '@/lib/ai/client'
import { sendEmail, morningBriefHtml, morningBriefText } from '@/lib/email/resend'

export const runtime  = 'nodejs'
export const dynamic  = 'force-dynamic'
export const maxDuration = 300 // 5 min — enough to process ~50 users serially

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // Must configure CRON_SECRET in Vercel env
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin  = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const today  = new Date().toISOString().slice(0, 10)
  const start  = Date.now()

  // Fetch all active user profiles with auto_brief enabled
  const { data: profiles, error: profErr } = await admin
    .from('user_profiles')
    .select('id, full_name, billing_email, google_email')
    .limit(100)

  if (profErr || !profiles) {
    console.error('[cron/brief] Failed to fetch profiles:', profErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Find users who already have a brief today (skip them)
  const { data: existing } = await admin
    .from('daily_briefs')
    .select('user_id')
    .eq('brief_date', today)

  const alreadyDone = new Set((existing ?? []).map((b: any) => b.user_id))
  const pending = profiles.filter((p: any) => !alreadyDone.has(p.id))

  let generated = 0
  let skipped   = alreadyDone.size
  let failed    = 0

  for (const profile of pending) {
    const uid = profile.id
    try {
      // Fetch this user's context (tasks, academic modules, thesis chapters)
      const [tasksR, modulesR, chaptersR] = await Promise.all([
        admin.from('tasks').select('title,domain,priority,due_date,status')
          .eq('user_id', uid).not('status', 'in', '("done","cancelled")')
          .order('due_date', { ascending: true }).limit(8),
        admin.from('academic_modules').select('title,status,deadline')
          .eq('user_id', uid).not('status', 'in', '("passed","failed")').limit(5),
        admin.from('thesis_chapters').select('title,chapter_num,status,word_count,target_words')
          .eq('user_id', uid).order('chapter_num').limit(5),
      ])

      // Skip users with no data to brief on
      const taskCount = tasksR.data?.length ?? 0
      const modCount  = modulesR.data?.length ?? 0
      if (taskCount + modCount === 0) { skipped++; continue }

      const ctx = [
        `Today: ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}`,
        `OPEN TASKS (${taskCount}):\n${tasksR.data?.map(t => `- [${t.priority}] ${t.title} (${t.domain}) — ${t.due_date ? new Date(t.due_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : 'no deadline'}`).join('\n') || 'none'}`,
        `ACADEMIC MODULES:\n${modulesR.data?.map(m => `- ${m.title} [${m.status}] — deadline: ${m.deadline ? new Date(m.deadline).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'TBD'}`).join('\n') || 'none'}`,
        chaptersR.data?.length ? `THESIS CHAPTERS:\n${chaptersR.data.map(c => `Ch.${c.chapter_num} ${c.title}: ${c.word_count ?? 0}/${c.target_words ?? 8000} words [${c.status}]`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n')

      const system = `You are PIOS, a PhD/DBA student's integrated OS. Generate a personalised morning brief for today.
Be warm but direct. Focus on highest-priority items. Flag any overdue tasks or upcoming deadlines.
Maximum 200 words. Plain prose only. No bullet points.`

      const content = await callClaude(
        [{ role: 'user', content: `Generate my morning brief.\n\n${ctx}` }],
        system, 500
      )

      await admin.from('daily_briefs').upsert({
        user_id:   uid,
        brief_date: today,
        content,
        ai_model:  'claude-sonnet-4-20250514',
        generated_by: 'cron',
      }, { onConflict: 'user_id,brief_date' })

      // Deliver brief by email if user has an address stored
      const userEmail = (profile as any).billing_email ?? (profile as any).google_email
      const userName  = (profile as any).full_name ?? 'there'
      if (userEmail) {
        await sendEmail({
          to:      userEmail,
          subject: `Your PIOS Brief — ${new Date(today).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}`,
          html:    morningBriefHtml(content, today, userName),
          text:    morningBriefText(content, today, userName),
        })
      }

      generated++
    } catch (err: any) {
      console.error(`[cron/brief] Failed for user ${uid}:`, err.message)
      failed++
    }
  }

  const elapsed = Math.round((Date.now() - start) / 1000)
  console.log(`[cron/brief] Done: ${generated} generated, ${skipped} skipped, ${failed} failed in ${elapsed}s`)

  return NextResponse.json({ date: today, generated, skipped, failed, elapsed_s: elapsed })
}
