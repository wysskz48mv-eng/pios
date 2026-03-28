import { NextResponse } from 'next/server'

/**
 * POST /api/stripe/setup
 * Creates the 3 PIOS subscription products + prices in Stripe.
 * Run ONCE after adding STRIPE_SECRET_KEY to Vercel.
 * Returns the price IDs — paste them into Vercel env vars.
 *
 * Products created:
 *   PIOS Starter   — £29/month
 *   PIOS Pro       — £79/month
 *   PIOS Enterprise — £199/month
 *
 * VeritasIQ Technologies Ltd
 */

export const dynamic = 'force-dynamic'

const PLANS = [
  {
    envKey:      'NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID',
    name:        'PIOS Starter',
    description: 'Personal Intelligence OS — Starter tier. NemoClaw™ AI, core platform modules, 100 AI credits/month.',
    amount:      2900,   // £29.00 in pence
    tier:        'starter',
  },
  {
    envKey:      'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
    name:        'PIOS Pro',
    description: 'PIOS Pro — full platform access. 500 AI credits/month, all 13 NemoClaw™ frameworks, content pipeline.',
    amount:      7900,
    tier:        'pro',
  },
  {
    envKey:      'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
    name:        'PIOS Enterprise',
    description: 'PIOS Enterprise — unlimited AI credits, white-label options, priority support.',
    amount:      19900,
    tier:        'enterprise',
  },
]

export async function POST() {
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
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not set' }, { status: 503 })
  }

  const existing = [
    process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
  ].filter(Boolean)

  return NextResponse.json({
    price_ids_configured: existing.length,
    starter:    process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID    ?? 'NOT SET',
    pro:        process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID         ?? 'NOT SET',
    enterprise: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ?? 'NOT SET',
    ready:      existing.length === 3,
    instructions: existing.length < 3
      ? 'POST to /api/stripe/setup to create products and get price IDs'
      : 'All price IDs configured',
  })
}
