import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminRouteEnabled, requireOwnerEmail } from '@/lib/security/route-guards'

/**
 * POST /api/stripe/setup
 * Creates the adopted PIOS subscription products + prices in Stripe.
 * Run ONCE after adding STRIPE_SECRET_KEY to Vercel.
 * Returns the price IDs — paste them into Vercel env vars.
 *
 * Products created:
 *   PIOS Spark      — £16/month
 *   PIOS Pro        — £35/month
 *   PIOS Executive  — £65/month
 *   PIOS Enterprise — £75/seat/month
 *
 * VeritasIQ Technologies Ltd
 */

export const dynamic = 'force-dynamic'

const PLANS = [
  {
    envKey:      'STRIPE_PRICE_SPARK',
    name:        'PIOS Spark',
    description: 'PIOS Spark — entry tier for students and early-career professionals.',
    amount:      1600,
    tier:        'spark',
  },
  {
    envKey:      'STRIPE_PRICE_PRO',
    name:        'PIOS Pro',
    description: 'PIOS Pro — consultant tier with full framework-led professional workspace.',
    amount:      3500,
    tier:        'pro',
  },
  {
    envKey:      'STRIPE_PRICE_EXECUTIVE',
    name:        'PIOS Executive',
    description: 'PIOS Executive — premium decision-support and operating system for leaders.',
    amount:      6500,
    tier:        'executive',
  },
  {
    envKey:      'STRIPE_PRICE_ENTERPRISE',
    name:        'PIOS Enterprise',
    description: 'PIOS Enterprise — team-grade controls, compliance, and enterprise support.',
    amount:      7500,
    tier:        'enterprise',
  },
]

async function authorizeStripeSetupRoute() {
  const blocked = requireAdminRouteEnabled('ENABLE_ADMIN_BILLING_ROUTES')
  if (blocked) return { error: blocked }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const ownerErr = requireOwnerEmail(user.email)
  if (ownerErr) return { error: ownerErr }

  return { error: null }
}

export async function POST() {
  const auth = await authorizeStripeSetupRoute()
  if (auth.error) return auth.error

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json(
      { error: 'STRIPE_SECRET_KEY not set in Vercel env vars' },
      { status: 503 }
    )
  }

  const results: Array<{
    plan: string; product_id: string; price_id: string
    env_key: string; amount: string; status: string
  }> = []

  for (const plan of PLANS) {
    try {
      // Create product
      const productRes = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name:                    plan.name,
          description:             plan.description,
          'metadata[tier]':        plan.tier,
          'metadata[platform]':    'pios',
          'metadata[provider]':    'veritasiq',
        }),
      })
      const product = await productRes.json()
      if (!productRes.ok) throw new Error(product.error?.message ?? 'Product creation failed')

      // Create recurring price
      const priceRes = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          product:                    product.id,
          unit_amount:                String(plan.amount),
          currency:                   'gbp',
          'recurring[interval]':      'month',
          'recurring[interval_count]':'1',
          'metadata[tier]':           plan.tier,
        }),
      })
      const price = await priceRes.json()
      if (!priceRes.ok) throw new Error(price.error?.message ?? 'Price creation failed')

      results.push({
        plan:       plan.name,
        product_id: product.id,
        price_id:   price.id,
        env_key:    plan.envKey,
        amount:     `£${(plan.amount / 100).toFixed(2)}/month`,
        status:     'created',
      })
    } catch (err: unknown) {
      results.push({
        plan:       plan.name,
        product_id: '',
        price_id:   '',
        env_key:    plan.envKey,
        amount:     `£${(plan.amount / 100).toFixed(2)}/month`,
        status:     `error: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  const succeeded = results.filter(r => r.status === 'created')
  const failed    = results.filter(r => r.status !== 'created')

  // Format as clear copy-paste instructions
  const envInstructions = succeeded.map(r =>
    `${r.env_key}=${r.price_id}`
  ).join('\n')

  return NextResponse.json({
    ok:      failed.length === 0,
    results,
    summary: `${succeeded.length}/${PLANS.length} products created`,
    next_step: succeeded.length > 0
      ? `Add these to Vercel → PIOS → Environment Variables, then redeploy:\n\n${envInstructions}`
      : 'All failed — check STRIPE_SECRET_KEY is correct and Stripe account is active',
  })
}

// GET — check if products already exist
export async function GET() {
  const auth = await authorizeStripeSetupRoute()
  if (auth.error) return auth.error

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not set' }, { status: 503 })
  }

  const existing = [
    process.env.STRIPE_PRICE_SPARK ?? process.env.STRIPE_PRICE_STUDENT,
    process.env.STRIPE_PRICE_PRO,
    process.env.STRIPE_PRICE_EXECUTIVE ?? process.env.STRIPE_PRICE_PROFESSIONAL,
    process.env.STRIPE_PRICE_ENTERPRISE ?? process.env.STRIPE_PRICE_TEAM,
  ].filter(Boolean)

  return NextResponse.json({
    price_ids_configured: existing.length,
    spark:      process.env.STRIPE_PRICE_SPARK      ?? process.env.STRIPE_PRICE_STUDENT      ?? 'NOT SET',
    pro:        process.env.STRIPE_PRICE_PRO        ?? 'NOT SET',
    executive:  process.env.STRIPE_PRICE_EXECUTIVE  ?? process.env.STRIPE_PRICE_PROFESSIONAL ?? 'NOT SET',
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? process.env.STRIPE_PRICE_TEAM         ?? 'NOT SET',
    ready:      existing.length === 4,
    instructions: existing.length < 4
      ? 'POST to /api/stripe/setup to create products and get price IDs'
      : 'All price IDs configured',
  })
}
