/**
 * GET  /api/billing  — tenant billing state + usage summary
 * POST /api/billing  — update billing email
 *
 * Returns Stripe subscription status, plan, credits used,
 * pending Vercel env flags, and onboarding readiness.
 *
 * PIOS™ v3.6.0 | Sprint M — Billing API | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PLANS = {
  student:      { name:'Student',      price:9,    credits:2000  },
  professional: { name:'Professional', price:29,   credits:10000 },
  executive:    { name:'Executive',    price:79,   credits:50000 },
  enterprise:   { name:'Enterprise',   price:199,  credits:200000 },
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [profileR, tenantR, usageR] = await Promise.all([
      supabase.from('user_profiles')
        .select('full_name,tenant_id,billing_email,google_email,nemoclaw_calibrated,organisation')
        .eq('id', user.id).single(),
      supabase.from('tenants')
        .select('plan,stripe_customer_id,stripe_subscription_id,stripe_subscription_status,ai_credits_used,ai_credits_limit,trial_ends_at,billing_email')
        .single(),
      supabase.from('ai_usage_log')
        .select('tokens_used,model,created_at')
        .eq('user_id', user.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .limit(500),
    ])

    const profile = profileR.data as any
    const tenant  = tenantR.data  as any
    const usage   = usageR.data   as any[] ?? []

    const plan      = tenant?.plan ?? 'professional'
    const planInfo  = PLANS[plan as keyof typeof PLANS] ?? PLANS.professional
    const credLimit = tenant?.ai_credits_limit ?? planInfo.credits
    const credUsed  = usage.reduce((s, r) => s + (Number(r.tokens_used) || 0), 0)
    const credPct   = credLimit > 0 ? Math.round(credUsed / credLimit * 100) : 0

    // Infrastructure readiness flags
    const hasStripe = Boolean(tenant?.stripe_customer_id)
    const hasSub    = Boolean(tenant?.stripe_subscription_id)
    const subStatus = tenant?.stripe_subscription_status ?? 'inactive'
    const isLive    = Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_live'))
    const hasResend = Boolean(process.env.RESEND_API_KEY)
    const hasCron   = Boolean(process.env.CRON_SECRET)

    return NextResponse.json({
      ok: true,
      user:  { id: user.id, email: user.email, name: profile?.full_name },
      plan:  { id: plan, ...planInfo },
      billing: {
        status:           subStatus,
        customer_id:      hasStripe ? tenant.stripe_customer_id : null,
        subscription_id:  hasSub    ? tenant.stripe_subscription_id : null,
        trial_ends_at:    tenant?.trial_ends_at ?? null,
        billing_email:    tenant?.billing_email ?? profile?.billing_email ?? user.email,
      },
      usage: {
        credits_used:     credUsed,
        credits_limit:    credLimit,
        credits_pct:      credPct,
        calls_this_month: usage.length,
        top_model:        usage.length > 0
          ? usage.reduce((acc, r) => { acc[r.model] = (acc[r.model]||0)+1; return acc }, {} as Record<string,number>)
          : {},
      },
      readiness: {
        stripe_live:  isLive,
        has_customer: hasStripe,
        has_sub:      hasSub,
        resend:       hasResend,
        cron:         hasCron,
        nemoclaw:     Boolean(profile?.nemoclaw_calibrated),
      },
    })
  } catch (err: any) {
    console.error('[PIOS billing GET]', err)
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { billing_email } = await req.json()
    if (billing_email) {
      await supabase.from('user_profiles')
        .update({ billing_email })
        .eq('id', user.id)
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 })
  }
}
