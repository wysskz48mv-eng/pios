/**
 * GET  /api/profile  — user profile + tenant plan + feed settings
 * PATCH /api/profile — update user_profiles fields
 *
 * Replaces direct supabase.from('user_profiles') + supabase.from('tenants')
 * calls in the settings page.
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ALLOWED_FIELDS = [
  'full_name', 'billing_email', 'programme_name', 'university',
  'timezone', 'job_title', 'organisation', 'phone',
  'preferred_domains', 'notification_prefs', 'avatar_url', 'persona_type',
]

const VALID_TIMEZONES_PARTIAL = [
  'Europe/', 'America/', 'Asia/', 'Africa/', 'Australia/', 'Pacific/', 'UTC',
]

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [profileR, tenantR] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', user.id).single(),
      supabase.from('tenants').select(
        'id,name,plan,plan_status,ai_credits_used,ai_credits_limit,trial_ends_at,subscription_id'
      ).limit(1).single(),
    ])

    return NextResponse.json({
      user: {
        id:    user.id,
        email: user.email,
      },
      profile: profileR.data ?? null,
      tenant:  tenantR.data  ?? null,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const safe: unknown = { updated_at: new Date().toISOString() }

    for (const k of ALLOWED_FIELDS) {
      if (k in body) safe[k] = body[k]
    }

    // Basic timezone validation
    if (safe.timezone) {
      const tz = safe.timezone as string
      const valid = VALID_TIMEZONES_PARTIAL.some(prefix => tz.startsWith(prefix)) || tz === 'UTC'
      if (!valid) return NextResponse.json({ error: 'invalid timezone' }, { status: 400 })
    }

    // Trim string fields
    for (const k of ['full_name','billing_email','programme_name','university','job_title','organisation']) {
      if (safe[k] !== undefined && typeof safe[k] === 'string') safe[k] = safe[k].trim()
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(safe)
      .eq('id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ profile: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
