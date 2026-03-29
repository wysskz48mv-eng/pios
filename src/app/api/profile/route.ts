/**
 * GET  /api/profile  — user profile + tenant plan + feed settings
 * PATCH /api/profile — update user_profiles fields
 *
 * Sprint 63: added `onboarded` to ALLOWED_FIELDS + NemoClaw™ first-run seed.
 * When onboarded=true is set for the first time on an executive/professional
 * persona, fires seed_frameworks via /api/ip-vault to pre-populate the
 * 15 NemoClaw™ framework cards in the IP Vault.
 *
 *  PIOS v3.0 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ALLOWED_FIELDS = [
  'full_name', 'billing_email', 'programme_name', 'university',
  'timezone', 'job_title', 'organisation', 'phone',
  'preferred_domains', 'notification_prefs', 'avatar_url', 'persona_type',
  'onboarded', 'cv_storage_path', 'cv_filename', 'cv_processing_status', 'cv_uploaded_at',
  'primary_project', 'consulting_context',
]

const VALID_TIMEZONES_PARTIAL = [
  'Europe/', 'America/', 'Asia/', 'Africa/', 'Australia/', 'Pacific/', 'UTC',
]

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Use service client — bypasses RLS, guarantees all columns including new ones
    const admin = createServiceClient()

    const { data: profileData } = await admin
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Tenant lookup via profile's tenant_id
    const tenantId = profileData?.tenant_id
    const { data: tenantData } = tenantId
      ? await admin.from('tenants').select(
          'id,name,plan,plan_status,ai_credits_used,ai_credits_limit,trial_ends_at,subscription_id,stripe_customer_id,stripe_subscription_id'
        ).eq('id', tenantId).single()
      : { data: null }

    return NextResponse.json({
      user:    { id: user.id, email: user.email },
      profile: profileData ?? null,
      tenant:  tenantData  ?? null,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Auth check via user client (respects session cookies)
    const supabase    = createClient()
    const serviceDb   = createServiceClient()   // bypasses RLS for writes
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const safe: Record<string, unknown> = { updated_at: new Date().toISOString() }

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
    for (const k of ['full_name','billing_email','programme_name','university','job_title','organisation','primary_project','consulting_context']) {
      if (safe[k] !== undefined && typeof safe[k] === 'string') {
        safe[k] = (safe[k] as string).trim()
      }
    }

    // Read current state (service client to avoid RLS blocking the read too)
    const { data: existing } = await serviceDb
      .from('user_profiles')
      .select('onboarded, persona_type, tenant_id')
      .eq('id', user.id)
      .single()

    const wasOnboarded   = existing?.onboarded === true
    const newOnboarded   = safe.onboarded === true
    const persona        = (safe.persona_type as string | undefined) ?? existing?.persona_type ?? 'executive'
    const isProfessional = ['executive', 'professional', 'founder', 'consultant'].includes(persona)

    // If no profile row yet, create tenant + profile first
    if (!existing) {
      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      const { data: tenant } = await serviceDb.from('tenants').insert({
        name:                user.email?.split('@')[0] ?? 'My PIOS',
        slug:                user.id.substring(0, 8),
        plan:                'individual',
        plan_status:         'trialing',
        subscription_status: 'trialing',
        trial_ends_at:       trialEndsAt,
        ai_credits_limit:    5000,
      }).select().single()

      if (tenant) {
        safe.tenant_id = tenant.id
        safe.role      = 'owner'
      }
    }

    // Upsert using service client — bypasses RLS
    const { data, error } = await serviceDb
      .from('user_profiles')
      .upsert({ id: user.id, ...safe })
      .eq('id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // ── NemoClaw™ first-run seed ─────────────────────────────────────────────
    // Fires exactly once: when onboarded transitions false → true for
    // executive or professional personas. Seeds 15 NemoClaw™ frameworks
    // into ip_assets so they appear immediately in the IP Vault.
    let nemoclawSeeded = false
    if (newOnboarded && !wasOnboarded && isProfessional) {
      try {
        const host   = req.headers.get('host') ?? 'localhost:3000'
        const proto  = host.startsWith('localhost') ? 'http' : 'https'
        const origin = `${proto}://${host}`
        const seedRes = await fetch(`${origin}/api/ip-vault`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: req.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({ action: 'seed_frameworks' }),
        })
        if (seedRes.ok) {
          const seedData = await seedRes.json() as { seeded?: number }
          nemoclawSeeded = (seedData.seeded ?? 0) > 0
        }
      } catch {
        // Non-fatal — user can seed manually via /platform/ip-vault → Seed Frameworks
      }
    }

    return NextResponse.json({ profile: data, nemoclaw_seeded: nemoclawSeeded })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Internal server error' }, { status: 500 })
  }
}
