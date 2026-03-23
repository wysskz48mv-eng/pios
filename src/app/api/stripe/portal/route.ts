export const dynamic = 'force-dynamic'
/**
 * GET /api/stripe/portal
 * Redirects an existing PIOS subscriber to the Stripe Customer Portal
 * to manage their subscription, update payment method, or cancel.
 * PIOS v1.0 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/auth/login', request.url))

    // Get the tenant's Stripe customer ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_customer_id')
      .eq('id', profile?.tenant_id)
      .single()

    if (!tenant?.stripe_customer_id) {
      return NextResponse.redirect(
        new URL('/platform/settings?billing=not_subscribed', request.url)
      )
    }

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios-wysskz48mv-engs-projects.vercel.app'}/platform/settings?billing=returned`

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: returnUrl,
    })

    return NextResponse.redirect(session.url)
  } catch (err: any) {
    console.error('[PIOS] stripe/portal:', err)
    return NextResponse.redirect(
      new URL('/platform/settings?billing=error', request.url)
    )
  }
}
