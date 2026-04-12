/**
 * GET /api/onboarding  — platform onboarding checklist + readiness score
 * POST /api/onboarding — mark a step complete / generate personalised next-steps
 *
 * Aggregates completion state across all PIOS modules and surfaces
 * a prioritised action list for new users.
 *
 * PIOS™ v3.5.0 | Sprint K — Onboarding | VeritasIQ Technologies Ltd
 */
import { apiError } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { callClaude }                from '@/lib/ai/client'

export const dynamic = 'force-dynamic'

interface Step {
  id:       string
  label:    string
  desc:     string
  category: 'identity'|'professional'|'academic'|'platform'|'integration'
  priority: number
  action_url: string
  docs_url?:  string
}

const ONBOARDING_STEPS: Step[] = [
  // Identity
  { id:'profile',       label:'Complete your profile',          desc:'Add name, role, and professional context',       category:'identity',     priority:1, action_url:'/platform/settings' },
  { id:'nemoclaw',      label:'Calibrate NemoClaw™',            desc:'Upload CV to personalise AI responses',          category:'identity',     priority:2, action_url:'/platform/learning/wizard' },
  { id:'google_oauth',  label:'Connect Google account',         desc:'Enable Gmail + Calendar sync',                   category:'integration',  priority:3, action_url:'/platform/settings' },
  // Professional
  { id:'project',       label:'Create first project',           desc:'Add your organisation and active projects',      category:'professional', priority:2, action_url:'/platform/projects' },
  { id:'insight',       label:'Capture first insight',          desc:'Log a thought, idea, or observation',            category:'professional', priority:3, action_url:'/platform/intelligence' },
  { id:'task',          label:'Create first task',              desc:'Add a task to your professional workload',       category:'professional', priority:3, action_url:'/platform/tasks' },
  // Academic
  { id:'dba_setup',     label:'Configure DBA programme',        desc:'Set supervisors, chapter targets, milestones',   category:'academic',     priority:2, action_url:'/platform/academic' },
  { id:'viva_session',  label:'Run first viva practice',        desc:'Complete a mock viva session',                   category:'academic',     priority:4, action_url:'/platform/viva' },
  { id:'literature',    label:'Add literature item',            desc:'Add a paper to the literature hub',              category:'academic',     priority:4, action_url:'/platform/literature' },
  // Platform
  { id:'billing',       label:'Activate subscription',          desc:'Upgrade to unlock all features',                 category:'platform',     priority:1, action_url:'/platform/billing' },
  { id:'stripe_live',   label:'Configure Stripe (live)',        desc:'Add live Stripe keys to Vercel env',             category:'platform',     priority:1, action_url:'/platform/settings/models' },
  { id:'agents',        label:'Enable background agents',       desc:'Turn on IP monitor + DBA deadline alerts',       category:'platform',     priority:3, action_url:'/platform/agents' },
  // Integration
  { id:'resend',        label:'Verify email (RESEND)',          desc:'Add RESEND_API_KEY to enable email delivery',    category:'integration',  priority:2, action_url:'/platform/settings' },
  { id:'cron',          label:'Configure CRON secret',          desc:'Set CRON_SECRET in Vercel for scheduled tasks',  category:'integration',  priority:2, action_url:'/platform/settings' },
]

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check completion state per step
    const [profile, tasks, insights, chapters, litItems, userAgents, prefs] = await Promise.all([
      supabase.from('user_profiles').select('full_name,organisation,nemoclaw_calibrated,cv_processing_status,google_email').eq('id', user.id).single(),
      supabase.from('tasks').select('id').eq('user_id', user.id).limit(1),
      supabase.from('insights').select('id').eq('user_id', user.id).limit(1),
      supabase.from('thesis_chapters').select('id').eq('user_id', user.id).limit(1),
      supabase.from('literature_items').select('id').eq('user_id', user.id).limit(1),
      supabase.from('user_agents').select('agent_id,enabled').eq('user_id', user.id).eq('enabled', true),
      supabase.from('user_preferences').select('stripe_subscription_status,ai_model_routes').eq('user_id', user.id).single(),
    ])

    const p = (profile.data as any) ?? {}
    const prefData = (prefs.data as any) ?? {}

    const completedIds = new Set<string>()

    // Check each step
    if (p.full_name && p.organisation)        completedIds.add('profile')
    if (p.nemoclaw_calibrated || p.cv_processing_status === 'complete' || p.cv_processing_status === 'completed') {
      completedIds.add('nemoclaw')
    }
    if (p.google_email)                       completedIds.add('google_oauth')
    if ((tasks.data ?? []).length > 0)        completedIds.add('task')
    if ((insights.data ?? []).length > 0)     completedIds.add('insight')
    if ((chapters.data ?? []).length > 0)     completedIds.add('dba_setup')
    if ((litItems.data ?? []).length > 0)     completedIds.add('literature')
    if ((userAgents.data ?? []).length > 0)   completedIds.add('agents')
    if (prefData.stripe_subscription_status === 'active') completedIds.add('billing')

    // Infrastructure checks (env-based — approximate)
    const hasResend = Boolean(process.env.RESEND_API_KEY)
    const hasCron   = Boolean(process.env.CRON_SECRET)
    const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_live'))
    if (hasResend)       completedIds.add('resend')
    if (hasCron)         completedIds.add('cron')
    if (hasStripe)       completedIds.add('stripe_live')

    const steps = ONBOARDING_STEPS.map(s => ({
      ...s,
      completed: completedIds.has(s.id),
    }))

    const completedCount  = steps.filter(s => s.completed).length
    const totalCount      = steps.length
    const readinessPct    = Math.round(completedCount / totalCount * 100)
    const priorityPending = steps.filter(s => !s.completed).sort((a,b) => a.priority - b.priority)

    return NextResponse.json({
      ok: true,
      readiness_pct:    readinessPct,
      completed_count:  completedCount,
      total_steps:      totalCount,
      steps,
      priority_pending: priorityPending.slice(0, 5),
      by_category:      Object.fromEntries(
        ['identity','professional','academic','platform','integration'].map(cat => [cat, {
          total:     steps.filter(s => s.category === cat).length,
          completed: steps.filter(s => s.category === cat && s.completed).length,
        }])
      ),
    })
  } catch (err: any) {
    console.error('[PIOS onboarding GET]', err)
    return apiError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action, pending_steps, user_context } = body

    if (action === 'next-steps') {
      const pendingList = (pending_steps as any[] ?? [])
        .slice(0, 8)
        .map((s: any) => `${s.category.toUpperCase()} — ${s.label}: ${s.desc}`)
        .join('\n')

      const message = await callClaude(
        [{ role: 'user', content:
          `PIOS onboarding advisor. Given these pending setup steps for a new user, write a personalised 3-sentence welcome message and priority recommendations.\n\n` +
          `User context: ${user_context ?? 'CEO/Founder, DBA candidate'}\n\n` +
          `Pending steps:\n${pendingList || 'None — platform fully configured!'}\n\n` +
          `Write:\n1. A warm 1-sentence welcome tailored to their context\n2. Top 3 priority actions (be specific, mention the actual step names)\n3. One encouraging closing sentence\n\nBe concise and direct.`
        }],
        'You are a PIOS onboarding advisor. Write a concise, actionable welcome and priority list.',
        400,
        'haiku'
      )
      return NextResponse.json({ ok: true, action: 'next-steps', message })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[PIOS onboarding POST]', err)
    return apiError(err)
  }
}
