import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * POST /api/admin/seed-nemoclaw
 * Seeds NemoClaw™ calibration + exec intelligence config for current user.
 * Called from /platform/admin after migrations run.
 * Safe to re-run — upserts, not inserts.
 * VeritasIQ Technologies Ltd
 */

export const dynamic = 'force-dynamic'

// 13 proprietary NemoClaw™ frameworks
const NEMOCLAW_FRAMEWORKS = [
  { code: 'SDL',  name: 'Strategic Decision Layer',          tier: 'professional', domain: 'strategy' },
  { code: 'POM',  name: 'Priority & Obligation Matrix',      tier: 'professional', domain: 'operations' },
  { code: 'OAE',  name: 'Opportunity & Adversity Engine',    tier: 'professional', domain: 'strategy' },
  { code: 'CVDM', name: 'Cognitive & Value-Driven Method',   tier: 'professional', domain: 'decision' },
  { code: 'CPA',  name: 'Critical Path Architecture',        tier: 'professional', domain: 'planning' },
  { code: 'UMS',  name: 'Unified Management System',         tier: 'professional', domain: 'operations' },
  { code: 'VFO',  name: 'Value & Focus Optimiser',           tier: 'professional', domain: 'productivity' },
  { code: 'CFE',  name: 'Conflict & Friction Eliminator',    tier: 'professional', domain: 'leadership' },
  { code: 'ADF',  name: 'Adaptive Decision Framework',       tier: 'professional', domain: 'decision' },
  { code: 'GSM',  name: 'Growth & Sustainability Model',     tier: 'professional', domain: 'growth' },
  { code: 'SPA',  name: 'Stakeholder Power Analysis',        tier: 'professional', domain: 'stakeholders' },
  { code: 'RTE',  name: 'Risk & Threat Evaluator',           tier: 'professional', domain: 'risk' },
  { code: 'IML',  name: 'Impact & Motivation Ledger',        tier: 'professional', domain: 'performance' },
]

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const adminSb = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const results: string[] = []

    // 1. Upsert nemoclaw_calibration — default profile for Dimitry
    const { error: calErr } = await adminSb
      .from('nemoclaw_calibration')
      .upsert({
        user_id:                 user.id,
        full_name:               'Dimitry Masuku',
        job_title:               'Group CEO & Founder',
        organisation:            'VeritasIQ Technologies Ltd',
        seniority_level:         'C-Suite / Founder',
        primary_industry:        'PropTech / FM Technology',
        industries:              ['Facilities Management', 'PropTech', 'SaaS', 'Investigative Journalism', 'FM Consultancy'],
        skills:                  ['Strategic leadership', 'FM contract management', 'GCC service charge governance', 'SaaS product development', 'AI product strategy', 'Academic research'],
        qualifications:          ['DBA candidate (University of Portsmouth)', 'FM Consultancy (AECOM)', 'Facilities Management professional'],
        employers:               ['VeritasIQ Technologies Ltd', 'AECOM'],
        communication_register:  'direct',
        coaching_intensity:      'concise',
        recommended_frameworks:  ['SDL', 'POM', 'SPA', 'RTE', 'CPA'],
        strengths:               ['Multi-domain execution', 'Technical product leadership', 'GCC market expertise', 'Research and analysis'],
        growth_areas:            ['Delegation', 'Sales pipeline focus', 'External funding narrative'],
        decision_style:          'analytical_intuitive',
        calibration_summary:     'Founder/CEO of three interconnected SaaS platforms (VeritasEdge™, InvestiScript™, PIOS) with deep FM consultancy background and active DBA research. Operates across multiple simultaneous high-stakes workstreams. Communication style: direct, terse, sprint-oriented.',
        calibration_version:     1,
        updated_at:              new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (calErr) results.push(`⚠ nemoclaw_calibration: ${calErr.message}`)
    else results.push('✓ nemoclaw_calibration seeded')

    // 2. Upsert exec_intelligence_config
    const { error: eicErr } = await adminSb
      .from('exec_intelligence_config')
      .upsert({
        user_id:       user.id,
        ai_calls_used: 0,
        ai_calls_limit: 500,  // pro tier
        reset_date:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        brief_enabled: true,
        brief_time:    '07:00',
        timezone:      'Europe/London',
        persona:       'executive',
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (eicErr) results.push(`⚠ exec_intelligence_config: ${eicErr.message}`)
    else results.push('✓ exec_intelligence_config seeded (500 AI credits)')

    // 3. Upsert user_profiles with plan + persona
    const { error: profErr } = await adminSb
      .from('user_profiles')
      .update({
        plan:          'professional',
        billing_status:'active',
        persona_type:  'executive',
        onboarded:     true,
        full_name:     'Dimitry Masuku',
        updated_at:    new Date().toISOString(),
      })
      .eq('id', user.id)

    if (profErr) results.push(`⚠ user_profiles: ${profErr.message}`)
    else results.push('✓ user_profiles: plan=professional, persona=executive, onboarded=true')

    // 4. Seed wellness streak (so dashboard streak shows)
    const { error: streakErr } = await adminSb
      .from('wellness_streaks')
      .upsert({
        user_id:           user.id,
        current_streak:    1,
        longest_streak:    1,
        last_activity_date: new Date().toISOString().split('T')[0],
        updated_at:        new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (streakErr) results.push(`⚠ wellness_streaks: ${streakErr.message}`)
    else results.push('✓ wellness_streaks seeded (1-day streak)')

    // 5. Seed intelligence_prefs
    const { error: intelErr } = await adminSb
      .from('intelligence_prefs')
      .upsert({
        user_id:       user.id,
        topics:        ['fm', 'gcc', 'saas', 'ai'],
        refresh_freq:  'daily',
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (intelErr) results.push(`⚠ intelligence_prefs: ${intelErr.message}`)
    else results.push('✓ intelligence_prefs seeded')

    // 6. Seed Blood Oath Chronicles series (if content_series exists)
    const { data: existingSeries } = await adminSb
      .from('content_series')
      .select('id')
      .eq('user_id', user.id)
      .eq('slug', 'blood-oath-chronicles')
      .single()

    if (!existingSeries) {
      const { error: seriesErr } = await adminSb
        .from('content_series')
        .insert({
          user_id:           user.id,
          title:             'Blood Oath Chronicles',
          slug:              'blood-oath-chronicles',
          platform:          'pocket_fm',
          studio_url:        'https://studio.pocketfm.com',
          genre:             'African supernatural thriller',
          status:            'active',
          total_episodes:    174,
          published_episodes: 71,
          current_episode:   72,
          word_target:       1375,
          bible:             'Protagonist: Kaelo Mthembu. Setting: South Africa. Layer 1 (1-300): Regional revenge. Layer 2 (301-800): Pan-African conspiracy. Layer 3 (801-2000): Supernatural/cosmic Blood Oath. Format: 1300-1450 words per episode, one scene, cliffhanger every episode.',
          created_at:        new Date().toISOString(),
          updated_at:        new Date().toISOString(),
        })
      if (seriesErr) results.push(`⚠ content_series: ${seriesErr.message}`)
      else results.push('✓ Blood Oath Chronicles series seeded (ep 72 active)')
    } else {
      results.push('✓ Blood Oath Chronicles already exists — skipped')
    }

    return NextResponse.json({
      ok:      true,
      results,
      summary: `${results.filter(r => r.startsWith('✓')).length} succeeded, ${results.filter(r => r.startsWith('⚠')).length} warnings`,
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
