/**
 * POST /api/nps  — submit NPS pilot survey response
 * GET  /api/nps  — aggregate results (owner only)
 *
 * SRAF D-02: Pilot Customer Score — GA readiness gate (>4.0/5.0)
 * PIOS v2.4.3 | VeritasIQ Technologies Ltd | Sprint 56
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const OWNER_EMAIL = 'info@sustain-intl.com'
const SURVEY_URL  = process.env.NPS_SURVEY_URL ?? 'https://forms.gle/placeholder'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const { stability, performance, security, featureFit, nps, openFeedback } = body

  if (
    typeof stability   !== 'number' || (stability as number)   < 1 || (stability as number)   > 5 ||
    typeof performance !== 'number' || (performance as number) < 1 || (performance as number) > 5 ||
    typeof featureFit  !== 'number' || (featureFit as number)  < 1 || (featureFit as number)  > 5 ||
    typeof nps         !== 'number' || (nps as number)         < 0 || (nps as number)         > 10 ||
    typeof security    !== 'boolean'
  ) {
    return NextResponse.json({ error: 'Invalid survey data' }, { status: 400 })
  }

  const cps = Number((((stability as number) + (performance as number) + (featureFit as number)) / 3).toFixed(2))

  await supabase.from('nps_survey_responses').insert({
    user_id:      user?.id ?? null,
    platform:     'pios',
    stability:    stability as number,
    performance:  performance as number,
    security:     security as boolean,
    feature_fit:  featureFit as number,
    nps:          nps as number,
    cps,
    open_feedback:(openFeedback as string) ?? null,
  }).catch(() => null)   // table created by M014

  return NextResponse.json({ ok: true, cps, nps, message: 'Thank you — your feedback shapes our roadmap.' })
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabase
    .from('nps_survey_responses')
    .select('stability,performance,feature_fit,nps,cps,created_at')
    .eq('platform', 'pios')
    .order('created_at', { ascending: false })

  if (!data || data.length === 0) {
    return NextResponse.json({
      responses: 0,
      message: 'No NPS data yet.',
      survey_url: SURVEY_URL,
      action: 'Share survey link with programme participants / supervisors at milestone',
    })
  }

  const count      = data.length
  const avg_cps    = Number((data.reduce((s,r) => s + (r.cps ?? 0), 0) / count).toFixed(2))
  const avg_nps    = Number((data.reduce((s,r) => s + (r.nps ?? 0), 0) / count).toFixed(1))
  const promoters  = data.filter(r => r.nps >= 9).length
  const detractors = data.filter(r => r.nps <= 6).length
  const nps_score  = Math.round(((promoters - detractors) / count) * 100)

  return NextResponse.json({
    responses: count, avg_cps, avg_nps, nps_score,
    ga_ready:  count >= 5 && avg_cps >= 4.0,
    ga_threshold: { min_responses: 5, min_cps: 4.0 },
  })
}
