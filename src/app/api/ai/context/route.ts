import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfilePersonaModuleState } from '@/lib/profile-persona-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [profileState, { data: profile }, { data: calibration }, taskCount, emailUrgentCount] = await Promise.all([
      getProfilePersonaModuleState(user.id),
      supabase
        .from('user_profiles')
        .select('full_name,job_title,organisation,persona_type,active_personas,active_module_codes')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('nemoclaw_calibration')
        .select('communication_register,coaching_intensity,recommended_frameworks,top_competencies,cv_profile_summary')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('tasks')
        .select('*', { head: true, count: 'exact' })
        .eq('user_id', user.id)
        .in('status', ['todo', 'in_progress', 'blocked']),
      supabase
        .from('email_items')
        .select('*', { head: true, count: 'exact' })
        .eq('user_id', user.id)
        .eq('triage_class', 'urgent')
        .eq('is_read', false),
    ])

    return NextResponse.json({
      ok: true,
      context: {
        profile: {
          full_name: profile?.full_name ?? null,
          job_title: profile?.job_title ?? null,
          organisation: profile?.organisation ?? null,
          persona_type: profile?.persona_type ?? null,
          active_personas: profileState.activePersonas,
          active_modules: profileState.activeModules,
          workload_tracking_enabled: profileState.workloadTrackingEnabled,
        },
        calibration: calibration ?? null,
        workload: {
          open_tasks: taskCount.count ?? 0,
          urgent_unread_emails: emailUrgentCount.count ?? 0,
        },
      },
    })
  } catch (error) {
    console.error('[api/ai/context][GET]', error)
    return NextResponse.json({ error: 'Failed to load AI context' }, { status: 500 })
  }
}
