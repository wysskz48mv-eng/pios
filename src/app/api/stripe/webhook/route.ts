import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
  let event: any
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { user_id, plan } = session.metadata
    const limits: Record<string, number> = { student: 2000, individual: 5000, professional: 15000 }
    const { data: profileData } = await supabase
      .from('user_profiles').select('tenant_id').eq('id', user_id).single()
    if (profileData?.tenant_id) {
      await supabase.from('tenants').update({
        plan,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        subscription_status: 'active',
        ai_credits_limit: limits[plan] || 5000,
      }).eq('id', profileData.tenant_id)
    }
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    await supabase.from('tenants')
      .update({ subscription_status: sub.status })
      .eq('stripe_subscription_id', sub.id)
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    await supabase.from('tenants')
      .update({ subscription_status: 'canceled' })
      .eq('stripe_subscription_id', sub.id)
  }

  return NextResponse.json({ received: true })
}
