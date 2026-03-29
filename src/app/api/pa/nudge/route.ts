import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * GET /api/pa/nudge
 * Returns the single most important proactive nudge for the user right now.
 * Called on page load and every 30 minutes by the PA widget.
 *
 * Staleness radar checks:
 *   - Tasks overdue > 2 days and high priority → "Your [task] is overdue"
 *   - OKR not updated in 7+ days → "OKR [X] hasn't been updated in N days"
 *   - Decision open 14+ days → "Decision [X] has been open for N days"
 *   - Stakeholder overdue contact → "[Name] is due a touchpoint"
 *   - Document expiring in 14 days → "[Doc] expires in N days"
 *   - No morning brief consumed today → "Your morning brief is ready"
 *
 * Returns the single highest-priority nudge.
 *
 * VeritasIQ Technologies Ltd · PIOS Sprint K+1
 */

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ nudge: null })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now     = new Date()
  const today   = now.toISOString().split('T')[0]
  const in14d   = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0]

  interface Nudge { priority: number; message: string }
  const nudges: Nudge[] = []

  // 1. High-priority overdue tasks
  const { data: overdueTasks } = await admin
    .from('tasks')
    .select('title, due_date, priority')
    .eq('user_id', user.id)
    .eq('priority', 'high')
    .neq('status', 'done')
    .lt('due_date', today)
    .limit(1)

  if (overdueTasks?.[0]) {
    const daysOver = Math.floor((now.getTime() - new Date(overdueTasks[0].due_date).getTime()) / 86400000)
    nudges.push({ priority: 10, message: `"${overdueTasks[0].title}" is ${daysOver} day${daysOver !== 1 ? 's' : ''} overdue. Shall I help you prioritise it?` })
  }

  // 2. Stale open decisions (>14 days)
  const { data: staleDecisions } = await admin
    .from('executive_decisions')
    .select('title, created_at')
    .eq('user_id', user.id)
    .eq('status', 'open')
    .lt('created_at', new Date(now.getTime() - 14 * 86400000).toISOString())
    .limit(1)

  if (staleDecisions?.[0]) {
    const daysOpen = Math.floor((now.getTime() - new Date(staleDecisions[0].created_at).getTime()) / 86400000)
    nudges.push({ priority: 8, message: `"${staleDecisions[0].title}" has been open for ${daysOpen} days. Ready to work through it?` })
  }

  // 3. OKR not updated in 7 days
  const { data: staleOKRs } = await admin
    .from('executive_okrs')
    .select('objective, updated_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lt('updated_at', new Date(now.getTime() - 7 * 86400000).toISOString())
    .limit(1)

  if (staleOKRs?.[0]) {
    const daysStale = Math.floor((now.getTime() - new Date(staleOKRs[0].updated_at).getTime()) / 86400000)
    nudges.push({ priority: 6, message: `Your OKR "${staleOKRs[0].objective.slice(0, 50)}..." hasn't been updated in ${daysStale} days. How's it progressing?` })
  }

  // 4. Document expiring in 14 days
  const { data: expiringDocs } = await admin
    .from('vault_documents')
    .select('title, expiry_date, doc_type')
    .eq('user_id', user.id)
    .lte('expiry_date', in14d)
    .gte('expiry_date', today)
    .limit(1)

  if (expiringDocs?.[0]) {
    const daysLeft = Math.ceil((new Date(expiringDocs[0].expiry_date).getTime() - now.getTime()) / 86400000)
    nudges.push({ priority: 9, message: `${expiringDocs[0].title ?? expiringDocs[0].doc_type} expires in ${daysLeft} days. Should I create a renewal task?` })
  }

  // 5. Overdue stakeholder contact
  const { data: stakes } = await admin
    .from('stakeholders')
    .select('name, last_contact_date, contact_cadence_days')
    .eq('user_id', user.id)
    .not('contact_cadence_days', 'is', null)
    .not('last_contact_date', 'is', null)
    .limit(20)

  const overdueStake = (stakes ?? []).find(s =>
    s.contact_cadence_days && s.last_contact_date &&
    (now.getTime() - new Date(s.last_contact_date).getTime()) > (s.contact_cadence_days * 86400000)
  )
  if (overdueStake) {
    nudges.push({ priority: 5, message: `It's time to touch base with ${(overdueStake as {name:string}).name}. Want me to draft a catch-up email?` })
  }

  // 6. Untriaged emails
  const { count: untriagedCount } = await admin
    .from('email_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('triage_class', null)

  if (untriagedCount && untriagedCount > 3) {
    nudges.push({ priority: 4, message: `You have ${untriagedCount} untriaged emails. Shall I process them now?` })
  }

  // Return highest priority nudge
  const topNudge = nudges.sort((a, b) => b.priority - a.priority)[0] ?? null

  return NextResponse.json({ nudge: topNudge?.message ?? null })
}
