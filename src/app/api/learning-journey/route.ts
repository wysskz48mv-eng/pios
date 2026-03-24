/**
 * GET  /api/learning-journey       — fetch milestones, CPD summary, persona config
 * POST /api/learning-journey       — seed milestones for a persona, log CPD activity
 * PATCH /api/learning-journey?id=  — update a milestone
 * VeritasIQ / PIOS v2.2 | Sprint 21
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ── Persona milestone templates ───────────────────────────────────────────────
const PERSONA_TEMPLATES: Record<string, Array<{
  title: string; milestone_type: string; category: string;
  alert_days_before: number; sort_order: number
}>> = {
  doctoral: [
    { title:'Programme Registration',         milestone_type:'registration',      category:'administrative', alert_days_before:30, sort_order:1  },
    { title:'Induction & Orientation',        milestone_type:'induction',         category:'academic',       alert_days_before:7,  sort_order:2  },
    { title:'Ethics Approval',                milestone_type:'ethics',            category:'research',       alert_days_before:21, sort_order:3  },
    { title:'Supervisory Team Confirmed',     milestone_type:'admin',             category:'administrative', alert_days_before:14, sort_order:4  },
    { title:'Systematic Literature Review',   milestone_type:'literature_review', category:'research',       alert_days_before:14, sort_order:5  },
    { title:'Research Proposal Submission',   milestone_type:'assessment',        category:'assessment',     alert_days_before:21, sort_order:6  },
    { title:'Upgrade from MPhil / Transfer',  milestone_type:'upgrade',           category:'assessment',     alert_days_before:30, sort_order:7  },
    { title:'Primary Data Collection',        milestone_type:'checkpoint',        category:'research',       alert_days_before:14, sort_order:8  },
    { title:'Analysis & Writing Phase',       milestone_type:'checkpoint',        category:'research',       alert_days_before:14, sort_order:9  },
    { title:'First Draft Submission',         milestone_type:'submission',        category:'academic',       alert_days_before:21, sort_order:10 },
    { title:'Thesis Final Submission',        milestone_type:'submission',        category:'academic',       alert_days_before:30, sort_order:11 },
    { title:'Viva Voce Examination',          milestone_type:'viva',              category:'assessment',     alert_days_before:21, sort_order:12 },
    { title:'Post-Viva Corrections',          milestone_type:'corrections',       category:'academic',       alert_days_before:14, sort_order:13 },
    { title:'Award Conferred',                milestone_type:'award',             category:'administrative', alert_days_before:7,  sort_order:14 },
  ],
  masters: [
    { title:'Programme Registration',         milestone_type:'registration',      category:'administrative', alert_days_before:14, sort_order:1 },
    { title:'Module 1 Assessment',            milestone_type:'assessment',        category:'academic',       alert_days_before:14, sort_order:2 },
    { title:'Module 2 Assessment',            milestone_type:'assessment',        category:'academic',       alert_days_before:14, sort_order:3 },
    { title:'Module 3 Assessment',            milestone_type:'assessment',        category:'academic',       alert_days_before:14, sort_order:4 },
    { title:'Research Methods Module',        milestone_type:'assessment',        category:'academic',       alert_days_before:14, sort_order:5 },
    { title:'Dissertation Proposal',          milestone_type:'submission',        category:'research',       alert_days_before:21, sort_order:6 },
    { title:'Ethics Clearance',               milestone_type:'ethics',            category:'research',       alert_days_before:14, sort_order:7 },
    { title:'Data Collection',                milestone_type:'checkpoint',        category:'research',       alert_days_before:14, sort_order:8 },
    { title:'Dissertation Submission',        milestone_type:'submission',        category:'academic',       alert_days_before:30, sort_order:9 },
    { title:'Viva / Oral Defence',            milestone_type:'viva',              category:'assessment',     alert_days_before:14, sort_order:10 },
    { title:'Award Conferred',                milestone_type:'award',             category:'administrative', alert_days_before:7,  sort_order:11 },
  ],
  undergraduate: [
    { title:'Enrolment & Module Selection',   milestone_type:'registration',      category:'administrative', alert_days_before:14, sort_order:1 },
    { title:'Year 1 Exams / Assessments',     milestone_type:'assessment',        category:'academic',       alert_days_before:21, sort_order:2 },
    { title:'Year 2 Exams / Assessments',     milestone_type:'assessment',        category:'academic',       alert_days_before:21, sort_order:3 },
    { title:'Placement / Year Abroad',        milestone_type:'checkpoint',        category:'professional',   alert_days_before:30, sort_order:4 },
    { title:'Final Year Project Proposal',    milestone_type:'submission',        category:'research',       alert_days_before:14, sort_order:5 },
    { title:'Final Year Project Submission',  milestone_type:'submission',        category:'academic',       alert_days_before:30, sort_order:6 },
    { title:'Finals / Dissertation Defence',  milestone_type:'assessment',        category:'assessment',     alert_days_before:14, sort_order:7 },
    { title:'Graduation',                     milestone_type:'award',             category:'administrative', alert_days_before:7,  sort_order:8 },
  ],
  cpd_professional: [
    { title:'CPD Year Start — Target Set',    milestone_type:'registration',      category:'cpd',            alert_days_before:7,  sort_order:1 },
    { title:'Q1 CPD Review (25% target)',     milestone_type:'checkpoint',        category:'cpd',            alert_days_before:14, sort_order:2 },
    { title:'Q2 CPD Review (50% target)',     milestone_type:'checkpoint',        category:'cpd',            alert_days_before:14, sort_order:3 },
    { title:'Q3 CPD Review (75% target)',     milestone_type:'checkpoint',        category:'cpd',            alert_days_before:14, sort_order:4 },
    { title:'Ethics CPD — Mandatory 1hr',     milestone_type:'mandatory',         category:'cpd',            alert_days_before:30, sort_order:5 },
    { title:'Annual CPD Declaration',         milestone_type:'submission',        category:'cpd',            alert_days_before:30, sort_order:6 },
    { title:'Membership Renewal',             milestone_type:'admin',             category:'professional',   alert_days_before:30, sort_order:7 },
    { title:'Performance Review / Appraisal', milestone_type:'checkpoint',        category:'professional',   alert_days_before:21, sort_order:8 },
  ],
  short_course: [
    { title:'Enrolment Confirmed',            milestone_type:'registration',      category:'administrative', alert_days_before:7,  sort_order:1 },
    { title:'Module / Unit 1 Complete',       milestone_type:'checkpoint',        category:'academic',       alert_days_before:7,  sort_order:2 },
    { title:'Mid-Course Assessment',          milestone_type:'assessment',        category:'academic',       alert_days_before:7,  sort_order:3 },
    { title:'Final Assessment / Exam',        milestone_type:'assessment',        category:'academic',       alert_days_before:14, sort_order:4 },
    { title:'Certificate Awarded',            milestone_type:'award',             category:'professional',   alert_days_before:3,  sort_order:5 },
  ],
  apprentice: [
    { title:'Apprenticeship Start',           milestone_type:'registration',      category:'administrative', alert_days_before:14, sort_order:1 },
    { title:'End-Point Assessment Gateway',   milestone_type:'assessment',        category:'assessment',     alert_days_before:30, sort_order:2 },
    { title:'Knowledge Modules Complete',     milestone_type:'checkpoint',        category:'academic',       alert_days_before:14, sort_order:3 },
    { title:'Portfolio Submission',           milestone_type:'submission',        category:'academic',       alert_days_before:21, sort_order:4 },
    { title:'End-Point Assessment',           milestone_type:'viva',              category:'assessment',     alert_days_before:21, sort_order:5 },
    { title:'Apprenticeship Certificate',     milestone_type:'award',             category:'professional',   alert_days_before:7,  sort_order:6 },
  ],
}

// ── CPD body requirements (annual hours) ─────────────────────────────────────
export const CPD_BODIES: Record<string, {
  name: string; totalHours: number; verifiableHours: number;
  yearStart: string; declaration: string; ethicsRequired: boolean
}> = {
  RICS:   { name:'RICS',    totalHours:20,  verifiableHours:10, yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:false },
  ICAEW:  { name:'ICAEW',   totalHours:20,  verifiableHours:5,  yearStart:'Nov',  declaration:'Oct 31', ethicsRequired:true  },
  ACCA:   { name:'ACCA',    totalHours:40,  verifiableHours:21, yearStart:'Jan',  declaration:'Jan 1',  ethicsRequired:false },
  CIPD:   { name:'CIPD',    totalHours:30,  verifiableHours:0,  yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:false },
  CIMA:   { name:'CIMA',    totalHours:40,  verifiableHours:20, yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:false },
  CIPS:   { name:'CIPS',    totalHours:30,  verifiableHours:15, yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:false },
  ICE:    { name:'ICE',     totalHours:30,  verifiableHours:15, yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:false },
  IET:    { name:'IET',     totalHours:30,  verifiableHours:15, yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:false },
  GMC:    { name:'GMC',     totalHours:50,  verifiableHours:25, yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:true  },
  NMC:    { name:'NMC',     totalHours:35,  verifiableHours:35, yearStart:'Jan',  declaration:'Mar 31', ethicsRequired:false },
  IFMA:   { name:'IFMA',    totalHours:30,  verifiableHours:15, yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:false },
  OTHER:  { name:'Other',   totalHours:20,  verifiableHours:10, yearStart:'Jan',  declaration:'Dec 31', ethicsRequired:false },
}

// ── GET ────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') ?? 'milestones'

  // Profile / persona
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('persona,cpd_body,cpd_hours_target,cpd_hours_done,study_mode,supervisor_name,supervisor_email,wizard_completed,wizard_persona,programme_name,programme_type')
    .eq('id', user.id).single()

  if (view === 'journal') {
    const { data: entries } = await supabase
      .from('learning_journal_entries')
      .select('id, title, content, mood, tags, ai_reflection, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    return NextResponse.json({ ok: true, view: 'journal', entries: entries ?? [] })
  }

  if (view === 'cpd') {
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const { data: activities } = await supabase
      .from('cpd_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('cpd_year', year)
      .order('completed_date', { ascending: false })

    const acts = (activities ?? []) as unknown[]
    const bodyInfo = CPD_BODIES[profile?.cpd_body ?? 'OTHER'] ?? CPD_BODIES.OTHER
    const verifiable    = acts.reduce((s: any, a) => s + (Number((a as any).hours_verifiable)     || 0), 0)
    const nonVerifiable: any = acts.reduce((s: any, a) => s + (Number((a as any).hours_non_verifiable) || 0), 0)
    const totalHours    = verifiable + nonVerifiable
    const target        = profile?.cpd_hours_target ?? bodyInfo.totalHours
    const pct           = target > 0 ? Math.round((totalHours / target) * 100) : 0

    return NextResponse.json({
      ok: true, view: 'cpd', year,
      body: bodyInfo,
      summary: { totalHours, verifiable, nonVerifiable, target, pct,
        verifiableTarget: bodyInfo.verifiableHours,
        verifiablePct: bodyInfo.verifiableHours > 0 ? Math.round((Number(verifiable) / bodyInfo.verifiableHours) * 100) : 100,
        onTrack: pct >= Math.round((new Date().getMonth() / 12) * 100),
      },
      activities: acts,
      cpd_bodies: CPD_BODIES,
    })
  }

  // Default: milestones view
  const { data: milestones } = await supabase
    .from('programme_milestones')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order').order('target_date', { ascending: true, nullsFirst: false })

  const ms     = (milestones ?? []) as unknown[]
  const now    = new Date()
  const passed = ms.filter((m: any) => (m as Record<string,unknown>).status === 'passed').length
  const total  = ms.length
  const overdue = ms.filter(m =>
    ((m as any)?.status === 'upcoming' || (m as any)?.status === 'in_progress') &&
    (m as any).target_date && new Date((m as any).target_date) < now
  ).length
  const nextDue = ms
    .filter((m: any) => (m as Record<string,unknown>).status === 'upcoming' || (m as any)?.status === 'in_progress')
    .sort((a, b) => new Date((a as any).target_date ?? '9999').getTime() - new Date((b as any).target_date ?? '9999').getTime())[0] ?? null

  return NextResponse.json({
    ok: true, view: 'milestones',
    profile,
    milestones: ms,
    summary: { total, passed, overdue, pct: Math.round((passed / Math.max(total,1)) * 100), nextDue },
    persona_templates: Object.keys(PERSONA_TEMPLATES),
    cpd_bodies: CPD_BODIES,
  })
}

// ── POST ───────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action } = body

  // ── Wizard completion + persona seed ─────────────────────────────────────
  // ── Professional wizard (founder / consultant / executive) ────────────────
  if (action === 'complete_professional_wizard') {
    const { persona, programme_name } = body as any

    // Update profile with professional persona type
    await (supabase as any).from('user_profiles').update({
      persona_type:  persona ?? 'founder',
      organisation:  programme_name ?? null,
      job_title:     persona === 'founder' ? 'Founder / CEO'
                   : persona === 'consultant' ? 'Consultant / Advisor'
                   : 'Executive',
    }).eq('id', user.id)

    return NextResponse.json({ ok: true, redirect: '/platform/dashboard' })
  }

  if (action === 'complete_wizard') {
    const { persona, cpd_body, cpd_hours_target, study_mode, supervisor_name, supervisor_email,
            programme_name, programme_type, wizard_persona } = body

    // Update profile
    await supabase.from('user_profiles').update({
      persona, cpd_body: cpd_body ?? null,
      cpd_hours_target: cpd_hours_target ?? 0,
      study_mode: study_mode ?? 'part_time',
      supervisor_name: supervisor_name ?? null,
      supervisor_email: supervisor_email ?? null,
      programme_name: programme_name ?? null,
      programme_type: programme_type ?? persona,
      wizard_completed: true,
      wizard_persona: wizard_persona ?? {},
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)

    // Delete existing milestones and re-seed
    await supabase.from('programme_milestones').delete().eq('user_id', user.id)

    const template = PERSONA_TEMPLATES[persona] ?? PERSONA_TEMPLATES.doctoral
    const rows = template.map(m => ({
      ...m, user_id: user.id, persona,
      cpd_body: cpd_body ?? null, status: 'upcoming',
    }))
    const { data: seeded } = await supabase.from('programme_milestones').insert(rows).select('id')
    return NextResponse.json({ ok: true, seeded: seeded?.length ?? 0, persona })
  }

  // ── Log CPD activity ──────────────────────────────────────────────────────
  if (action === 'log_cpd') {
    const { title, activity_type, provider, hours_verifiable, hours_non_verifiable,
            completed_date, cpd_body, reflection, evidence_url, tags } = body
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

    const cpd_year = completed_date
      ? new Date(completed_date).getFullYear()
      : new Date().getFullYear()

    const { data, error } = await supabase.from('cpd_activities').insert({
      user_id: user.id, cpd_body: cpd_body ?? null, title,
      activity_type: activity_type ?? 'course',
      provider: provider ?? null,
      hours_verifiable:     Number(hours_verifiable)     || 0,
      hours_non_verifiable: Number(hours_non_verifiable) || 0,
      completed_date: completed_date ?? null,
      cpd_year,
      evidence_url: evidence_url ?? null,
      reflection:   reflection   ?? null,
      tags:         tags ?? [],
    }).select('id,title,hours_verifiable,hours_non_verifiable,cpd_year').single()

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    return NextResponse.json({ ok: true, activity: data })
  }

  // ── Create single milestone ───────────────────────────────────────────────
  const { title, milestone_type, category, status, target_date, hours_credit,
          cpd_type, cpd_body, notes, alert_days_before } = body
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('user_profiles').select('persona').eq('id', user.id).single()

  if (action === 'journal_entry') {
    const { title, content, mood, tags } = body
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ ok: false, error: 'title and content required' }, { status: 400 })
    }
    // Try to insert — table may not exist yet (created by M012)
    const { data: entry, error: entryErr } = await supabase
      .from('learning_journal_entries')
      .insert({
        user_id:    user.id,
        title:      title.trim(),
        content:    content.trim(),
        mood:       mood ?? null,
        tags:       tags ?? [],
      })
      .select()
      .single()
    if (entryErr) {
      // Graceful fallback if table doesn't exist yet
      return NextResponse.json({ ok: false, error: 'Journal table not ready — run M012 migration', _pending: 'M012' })
    }
    return NextResponse.json({ ok: true, entry })
  }

  if (action === 'ai_reflect') {
    const { content } = body
    if (!content?.trim()) return NextResponse.json({ ok: false, error: 'content required' }, { status: 400 })
    try {
      const { callClaude } = await import('@/lib/ai/client')
      const reflection = await callClaude(
        [{ role: 'user', content: `Please provide a brief, thoughtful reflection on this learning journal entry. Identify key insights, suggest deeper questions to explore, and note any patterns or growth areas. Keep it to 3-4 sentences.

Journal entry:
${content.slice(0, 2000)}` }],
        'You are a supportive learning coach helping a professional reflect on their learning journey. Be insightful, constructive and specific.',
        300
      )
      return NextResponse.json({ ok: true, reflection })
    } catch (err: unknown) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? (err as Error).message : 'AI reflection failed' })
    }
  }

  const { data, error } = await supabase.from('programme_milestones').insert({
    user_id: user.id, persona: profile?.persona ?? 'student',
    title, milestone_type: milestone_type ?? 'checkpoint',
    category: category ?? 'academic', status: status ?? 'upcoming',
    target_date: target_date ?? null, hours_credit: Number(hours_credit) || 0,
    cpd_type: cpd_type ?? null, cpd_body: cpd_body ?? null,
    notes: notes ?? null, alert_days_before: alert_days_before ?? 14,
  }).select('id,title,status,target_date').single()

  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  return NextResponse.json({ ok: true, milestone: data })
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body  = await req.json()
  const allowed = ['title','milestone_type','category','status','target_date',
                   'completed_date','hours_credit','cpd_type','cpd_body',
                   'evidence_url','notes','alert_days_before','sort_order']
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const k of (allowed as any[])) { if (k in body) update[k] = body[k] }
  if (body.status === 'passed' && !body.completed_date) {
    update.completed_date = new Date().toISOString().slice(0, 10)
  }

  const { data, error } = await supabase
    .from('programme_milestones').update(update)
    .eq('id', id).eq('user_id', user.id)
    .select('id,title,status,completed_date').single()

  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  return NextResponse.json({ ok: true, milestone: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await supabase.from('programme_milestones').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
