export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const plan = searchParams.get('plan') as PlanKey
    if (!plan || !PLANS[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect('/auth/login')

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/platform/settings`,
      customer_email: user.email,
      metadata: { user_id: user.id, plan },
    })
    return NextResponse.redirect(session.url!)
  } catch (err: unknown) {
    console.error('[PIOS] stripe/checkout:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
