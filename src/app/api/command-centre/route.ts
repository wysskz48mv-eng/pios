/**
 * GET /api/command-centre
 * Returns live dashboard stats for all command centre variants.
 * Replaces hardcoded placeholder data in MeridianCC, OnyxCC, SignalCC.
 *
 * PIOS v3.7.2 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Parallel fetches for speed
    const [
      emailR, tasksR, okrsR, stakeholdersR, decisionsR,
      briefR, thesisR, modulesR, deadlinesR,
    ] = await Promise.all([
      // Email stats
      supabase.from('email_items').select('id, triage_class, status', { count: 'exact', head: false })
        .eq('user_id', user.id).in('status', ['triaged', 'unprocessed']),

      // Task stats
      supabase.from('tasks').select('id, status, priority, due_date', { count: 'exact', head: false })
        .eq('user_id', user.id).in('status', ['active', 'overdue']),

      // OKR stats
      supabase.from('exec_okrs').select('id, health, progress, status')
        .eq('user_id', user.id).eq('status', 'active'),

      // Stakeholder stats
      supabase.from('exec_stakeholders').select('id, last_interaction, next_touchpoint, importance')
        .eq('user_id', user.id),

      // Decision stats
      supabase.from('exec_decisions').select('id, status, review_date')
        .eq('user_id', user.id).eq('status', 'open'),

      // Latest brief
      supabase.from('daily_briefs').select('id, content, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),

      // Thesis chapters
      supabase.from('thesis_chapters').select('id, title, status, word_count, target_words')
        .eq('user_id', user.id),

      // Academic modules
      supabase.from('academic_modules').select('id, title, status, domain')
        .eq('user_id', user.id),

      // Upcoming deadlines (tasks with due dates in next 30 days)
      supabase.from('tasks').select('id, title, due_date, domain, priority')
        .eq('user_id', user.id).eq('status', 'active')
        .gte('due_date', today).lte('due_date', new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('due_date'),
    ])

    const emails = emailR.data ?? []
    const tasks = tasksR.data ?? []
    const okrs = okrsR.data ?? []
    const stakeholders = stakeholdersR.data ?? []
    const decisions = decisionsR.data ?? []
    const chapters = thesisR.data ?? []
    const modules = modulesR.data ?? []
    const deadlines = deadlinesR.data ?? []

    // Computed stats
    const emailUrgent = emails.filter(e => e.triage_class === 'urgent').length
    const emailUnread = emails.length
    const taskOverdue = tasks.filter(t => t.due_date && t.due_date < today).length
    const taskDueToday = tasks.filter(t => t.due_date === today).length
    const okrOnTrack = okrs.filter(o => o.health === 'on_track').length
    const okrTotal = okrs.length
    const okrAvgProgress = okrs.length ? Math.round(okrs.reduce((s, o) => s + (o.progress ?? 0), 0) / okrs.length) : 0

    const stakeholderOverdue = stakeholders.filter(s => {
      if (!s.next_touchpoint) return s.last_interaction && s.last_interaction < thirtyDaysAgo
      return s.next_touchpoint < today
    }).length

    const pendingDecisions = decisions.length

    // Thesis stats
    const totalWords = chapters.reduce((s, c) => s + (c.word_count ?? 0), 0)
    const targetWords = chapters.reduce((s, c) => s + (c.target_words ?? 0), 0) || 80000
    const thesisProgress = targetWords > 0 ? Math.round((totalWords / targetWords) * 100) : 0

    // Items requiring attention
    const attentionItems = emailUrgent + taskOverdue + stakeholderOverdue + pendingDecisions

    return NextResponse.json({
      email: {
        urgent: emailUrgent,
        unread: emailUnread,
        meeting: emails.filter(e => e.triage_class === 'meeting').length,
      },
      tasks: {
        active: tasks.length,
        overdue: taskOverdue,
        due_today: taskDueToday,
      },
      okrs: {
        total: okrTotal,
        on_track: okrOnTrack,
        at_risk: okrs.filter(o => o.health === 'at_risk').length,
        avg_progress: okrAvgProgress,
      },
      stakeholders: {
        total: stakeholders.length,
        overdue: stakeholderOverdue,
        critical: stakeholders.filter(s => s.importance === 'critical').length,
      },
      decisions: {
        pending: pendingDecisions,
      },
      thesis: {
        total_words: totalWords,
        target_words: targetWords,
        progress: thesisProgress,
        chapters: chapters.length,
      },
      academic: {
        modules: modules.length,
        active: modules.filter(m => m.status === 'active').length,
      },
      deadlines: deadlines.slice(0, 5).map(d => ({
        title: d.title,
        due_date: d.due_date,
        domain: d.domain,
        priority: d.priority,
        days_until: Math.ceil((new Date(d.due_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      })),
      attention_items: attentionItems,
      brief_available: (briefR.data?.length ?? 0) > 0,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    console.error('[PIOS command-centre]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
