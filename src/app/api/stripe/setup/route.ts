/**
 * POST /api/stripe/setup
 * One-time route: creates PIOS products + prices in Stripe and
 * returns the price IDs to add as Vercel env vars.
 *
 * Only callable by the owner (info@veritasiq.io).
 * Safe to run multiple times — looks up existing products by metadata
 * before creating, so it won't duplicate.
 *
 * PIOS v2.2 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'

const PRODUCTS = [
  {
    key:         'student',
    name:        'PIOS Student',
    description: 'Academic lifecycle + calendar + personal tasks. 50% off for .edu emails.',
    amount:      900,   // $9.00 USD
    envKey:      'STRIPE_PRICE_STUDENT',
    metadata:    { pios_plan: 'student' },
  },
  {
    key:         'student',
    name:        'PIOS Individual',
    description: 'Full PIOS MVP — all three core modules + Gmail + expenses.',
    amount:      900,   // $9.00 USD (student)
    envKey:      'STRIPE_PRICE_INDIVIDUAL',
    metadata:    { pios_plan: 'student' },
  },
  {
    key:         'professional',
    name:        'PIOS Professional',
    description: 'Full platform + FM consulting engine + priority support.',
    amount:      2400,  // $24.00 USD (professional)
    envKey:      'STRIPE_PRICE_PROFESSIONAL',
    metadata:    { pios_plan: 'professional' },
  },
]

export async function POST() {
  // Auth guard — owner only
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email !== 'info@veritasiq.io') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  }

  const results: Record<string, { productId: string; priceId: string; status: 'created' | 'existing' }> = {}

  for (const plan of PRODUCTS) {
    try {
      // Check if product already exists
      const existing = await stripe.products.search({
        query: `metadata['pios_plan']:'${plan.key}'`,
        limit: 1,
      })

      let productId: string
      let priceId:   string
      let status: 'created' | 'existing'

      if (existing.data.length > 0) {
        // Product exists — find its active monthly price
        productId = existing.data[0].id
        const prices = await stripe.prices.list({ product: productId, active: true, limit: 5 })
        const monthly = prices.data.find(p => p.recurring?.interval === 'month')
        if (monthly) {
          priceId = monthly.id
          status  = 'existing'
        } else {
          // Product exists but no monthly price — create one
          const price = await stripe.prices.create({
            product:    productId,
            unit_amount: plan.amount,
            currency:   'usd',
            recurring:  { interval: 'month' },
            metadata:   plan.metadata,
          })
          priceId = price.id
          status  = 'created'
        }
      } else {
        // Create product + price together
        const product = await stripe.products.create({
          name:        plan.name,
          description: plan.description,
          metadata:    plan.metadata,
        })
        productId = product.id

        const price = await stripe.prices.create({
          product:     productId,
          unit_amount: plan.amount,
          currency:    'usd',
          recurring:   { interval: 'month' },
          metadata:    plan.metadata,
        })
        priceId = price.id
        status  = 'created'
      }

      results[plan.key] = { productId, priceId, status }
    } catch (err: unknown) {
      console.error(`[stripe/setup] Failed for ${plan.key}:`, (err as Error).message)
      return NextResponse.json({ error: `Failed on ${plan.key}: ${(err as Error).message}` }, { status: 500 })
    }
  }

  // Format Vercel env var instructions
  const envVars = PRODUCTS.map(p => ({
    key:   p.envKey,
    value: results[p.key]?.priceId ?? 'ERROR',
    plan:  p.key,
    status: results[p.key]?.status,
  }))

  return NextResponse.json({
    success: true,
    message: 'Copy these price IDs into Vercel Environment Variables, then redeploy.',
    env_vars: envVars,
    vercel_url: 'https://vercel.com/wysskz48mv-eng/pios/settings/environment-variables',
    products: results,
  })
}
