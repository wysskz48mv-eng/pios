/**
 * POST /api/notifications/generate
 * Scans the user's data for time-sensitive events and inserts
 * smart notifications — deduplicated per day per event.
 *
 * Events covered:
 *  - IP asset renewals due within 30 / 7 days
 *  - Contract renewals due within 30 / 7 days
 *  - Wellness check-in streak break (missed yesterday)
 *  - Overdue tasks (more than 3 overdue)
 *  - Trial expiry (3 days and 1 day warnings)
 *
 * Idempotent — safe to call multiple times per day.
 * Called automatically by /api/cron/brief for all users.
 *
 * PIOS v3.0 | Sprint 82 | VeritasIQ Technologies Ltd
 */
import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const runtime    = 'nodejs'
export const dynamic    = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const cronSecret = process.env.CRON_SECRET
    const isCronCall = !!cronSecret && authHeader === `Bearer ${cronSecret}`

    let userId: string | null = null
    let supabase: ReturnType<typeof createClient> | ReturnType<typeof createAdminClient>

    if (isCronCall) {
      const body = await req.json().catch(() => ({} as Record<string, unknown>))
      userId = typeof body.user_id === 'string' ? body.user_id : null
      if (!userId) {
        return NextResponse.json({ error: 'user_id required for cron call' }, { status: 400 })
      }

      supabase = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    } else {
      supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      userId = user.id
    }

    const today     = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const in7d      = new Date(Date.now() +  7 * 86400000).toISOString().slice(0, 10)
    const in30d     = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    // Fetch existing notifications for today to deduplicate
    const { data: existingToday } = await supabase
      .from('notifications')
      .select('title')
      .eq('user_id', userId)
      .gte('created_at', today + 'T00:00:00Z')

    const alreadyNotified = new Set((existingToday ?? []).map(n => n.title))

    const toInsert: {
      user_id: string; title: string; body: string | null;
      type: string; domain: string | null; action_url: string | null; read: boolean
    }[] = []

    const addNotif = (title: string, body: string, type: string, domain: string, actionUrl: string) => {
      if (!alreadyNotified.has(title)) {
        toInsert.push({ user_id: userId!, title, body, type, domain, action_url: actionUrl, read: false })
        alreadyNotified.add(title) // prevent dupes within same batch
      }
    }

    // ── IP renewal alerts ─────────────────────────────────────────────────────
    try {
      const { data: ipAssets } = await (supabase as any)
        .from('ip_assets')
        .select('name,asset_type,renewal_date')
        .eq('user_id', userId)
        .eq('status', 'active')
        .lte('renewal_date', in30d)
        .gte('renewal_date', today)
        .order('renewal_date')

      for (const asset of (ipAssets ?? []) as any[]) {
        const daysLeft = Math.ceil((new Date(asset.renewal_date).getTime() - Date.now()) / 86400000)
        const isUrgent = daysLeft <= 7
        const title = `${isUrgent ? '⚠ URGENT: ' : ''}IP renewal due — ${asset.name}`
        addNotif(
          title,
          `${asset.asset_type} asset "${asset.name}" renews on ${new Date(asset.renewal_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} (${daysLeft} day${daysLeft !== 1 ? 's' : ''})`,
          isUrgent ? 'alert' : 'warning',
          'business',
          '/platform/ip-vault'
        )
      }
    } catch { /* table may not exist */ }

    // ── Contract renewal alerts ───────────────────────────────────────────────
    try {
      const { data: contracts } = await (supabase as any)
        .from('contracts')
        .select('title,contract_type,counterparty,end_date')
        .eq('user_id', userId)
        .eq('status', 'active')
        .lte('end_date', in30d)
        .gte('end_date', today)
        .order('end_date')

      for (const contract of (contracts ?? []) as any[]) {
        const daysLeft = Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86400000)
        const isUrgent = daysLeft <= 7
        const title = `${isUrgent ? '⚠ URGENT: ' : ''}Contract expires — ${contract.title}`
        addNotif(
          title,
          `${contract.contract_type} with ${contract.counterparty} expires ${new Date(contract.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} (${daysLeft} day${daysLeft !== 1 ? 's' : ''})`,
          isUrgent ? 'alert' : 'warning',
          'business',
          '/platform/contracts'
        )
      }
    } catch { /* table may not exist */ }

    // ── Wellness streak break ─────────────────────────────────────────────────
    try {
      const { data: streak } = await (supabase as any)
        .from('wellness_streaks')
        .select('current_streak,last_activity_date')
        .eq('user_id', userId)
        .eq('streak_type', 'daily_checkin')
        .single()

      if (streak && streak.current_streak > 3 && streak.last_activity_date === yesterday) {
        // Had a streak but didn't check in today — warn before midnight
        const hour = new Date().getUTCHours()
        if (hour >= 14) { // Only warn after 2pm UTC (avoid morning noise)
          addNotif(
            `🔥 Don't break your ${streak.current_streak}-day streak!`,
            `You haven't checked in today yet. Complete your wellness check-in to maintain your streak.`,
            'info',
            'wellness',
            '/platform/wellness'
          )
        }
      }
    } catch { /* table may not exist */ }

    // ── Overdue tasks summary ─────────────────────────────────────────────────
    try {
      const { count: overdueCount } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('status', 'in', '("done","cancelled")')
        .lt('due_date', today)

      if ((overdueCount ?? 0) >= 3) {
        addNotif(
          `${overdueCount} overdue tasks need attention`,
          `You have ${overdueCount} tasks past their due date. Review and reschedule or mark complete.`,
          'alert',
          'tasks',
          '/platform/tasks'
        )
      }
    } catch { /* silent */ }

    // ── Trial expiry warning ──────────────────────────────────────────────────
    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('trial_ends_at,plan_status')
        .limit(1).single()

      const t = tenantData as any
      if (t?.trial_ends_at && t?.plan_status === 'trialing') {
        const daysLeft = Math.ceil((new Date(t.trial_ends_at).getTime() - Date.now()) / 86400000)
        if (daysLeft === 3) {
          addNotif(
            '⏱ Trial ends in 3 days',
            'Your PIOS trial expires in 3 days. Subscribe to keep full access to all modules and AI features.',
            'warning',
            'billing',
            '/platform/billing'
          )
        } else if (daysLeft === 1) {
          addNotif(
            '⚠ Trial expires tomorrow',
            'Last day of your PIOS trial. Subscribe now to avoid losing access.',
            'alert',
            'billing',
            '/platform/billing'
          )
        }
      }
    } catch { /* silent */ }

    // ── Batch insert ──────────────────────────────────────────────────────────
    if (toInsert.length > 0) {
      await supabase.from('notifications').insert(toInsert)
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      generated: toInsert.length,
      skipped: alreadyNotified.size - toInsert.length,
    })

  } catch (err: unknown) {
    console.error('[notifications/generate]', err)
    return apiError(err)
  }
}
