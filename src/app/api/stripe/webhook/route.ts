import { NextResponse } from 'next/server'
import { stripe }         from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  const { Resend: R } = require('resend')
  return new R(key)
}

const FROM    = process.env.FROM_EMAIL ?? 'noreply@veritasiq.io'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pios.veritasiq.io'

const PLAN_LIMITS: Record<string, { credits: number; seats: number }> = {
  spark:        { credits: 2_000,   seats: 1 },
  pro:          { credits: 10_000,  seats: 1 },
  executive:    { credits: 50_000,  seats: 3 },
  enterprise:   { credits: 200_000, seats: 25 },
  // Legacy alias support
  student:      { credits: 2_000,   seats: 1 },
  starter:      { credits: 2_000,   seats: 1 },
  individual:   { credits: 10_000,  seats: 1 },
  professional: { credits: 50_000,  seats: 3 },
  team:         { credits: 200_000, seats: 25 },
}

export async function POST(request: Request) {
  const body = await request.text()
  const sig  = request.headers.get('stripe-signature')!

  let event: unknown
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // ── checkout.session.completed ────────────────────────────────────────────
  if ((event as any).type === 'checkout.session.completed') {
    const session = (event as any).data.object
    const { user_id, plan } = session.metadata ?? {}
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.spark

    const { data: profile } = await supabase
      .from('user_profiles').select('tenant_id,full_name').eq('id', user_id).single()

    if (profile?.tenant_id) {
      await supabase.from('tenants').update({
        plan,
        stripe_customer_id:     session.customer,
        stripe_subscription_id: session.subscription,
        subscription_status:    session.mode === 'subscription' ? 'active' : 'active',
        ai_credits_limit:       limits.credits,
        seats_limit:            limits.seats,
        updated_at:             new Date().toISOString(),
      }).eq('id', profile.tenant_id)

      // Welcome email
      const email = session.customer_details?.email
      if (email) {
        await getResend()?.emails.send({
          from: `PIOS <${FROM}>`,
          to:   email,
          subject: `Welcome to PIOS ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`,
          html: `<h2>You're all set!</h2>
<p>Hi ${profile.full_name ?? 'there'},</p>
<p>Your PIOS ${plan} plan is now active. You have ${limits.credits.toLocaleString()} AI credits/month.</p>
<p><a href="${APP_URL}/platform/dashboard">Go to your dashboard →</a></p>`,
        })
      }
    }
  }

  // ── customer.subscription.updated ────────────────────────────────────────
  if ((event as any).type === 'customer.subscription.updated') {
    const sub = (event as any).data.object
    const status = sub.status as string
    await supabase.from('tenants')
      .update({ subscription_status: status, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id)
  }

  // ── customer.subscription.deleted ────────────────────────────────────────
  if ((event as any).type === 'customer.subscription.deleted') {
    const sub = (event as any).data.object
    await supabase.from('tenants')
      .update({
        subscription_status: 'canceled',
        plan: 'student',
        ai_credits_limit: PLAN_LIMITS.spark.credits,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', sub.id)
  }

  // ── invoice.payment_succeeded — reset monthly AI credits ─────────────────
  if ((event as any).type === 'invoice.payment_succeeded') {
    const invoice = (event as any).data.object
    if (invoice.billing_reason === 'subscription_cycle') {
      await supabase.from('tenants')
        .update({ ai_credits_used: 0, updated_at: new Date().toISOString() })
        .eq('stripe_customer_id', invoice.customer)
    }
  }

  // ── invoice.payment_failed — alert user ───────────────────────────────────
  if ((event as any).type === 'invoice.payment_failed') {
    const invoice = (event as any).data.object
    await supabase.from('tenants')
      .update({ subscription_status: 'past_due', updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', invoice.customer)

    const email = invoice.customer_email
    if (email) {
      await getResend()?.emails.send({
        from: `PIOS <${FROM}>`,
        to:   email,
        subject: 'PIOS — Payment failed, please update your card',
        html: `<h2>Payment failed</h2>
<p>We couldn't process your PIOS subscription payment. Please update your payment method to avoid service interruption.</p>
<p><a href="${APP_URL}/platform/billing">Update payment method →</a></p>`,
      })
    }
  }

  // ── customer.subscription.trial_will_end (3-day warning) ──────────────────
  if ((event as any).type === 'customer.subscription.trial_will_end') {
    const sub = (event as any).data.object
    const { data: tenant } = await supabase.from('tenants')
      .select('id').eq('stripe_subscription_id', sub.id).single()

    if (tenant) {
      const { data: profile } = await supabase.from('user_profiles')
        .select('full_name,id').eq('tenant_id', tenant.id).limit(1).single()

      // Get email from Stripe customer
      const customer: any = await stripe.customers.retrieve(sub.customer as string)
      const email = customer?.email
      if (email) {
        await getResend()?.emails.send({
          from: `PIOS <${FROM}>`,
          to:   email,
          subject: 'Your PIOS trial ends in 3 days',
          html: `<h2>Trial ending soon</h2>
<p>Hi ${profile?.full_name ?? 'there'},</p>
<p>Your free PIOS trial ends in 3 days. Upgrade now to keep your data and AI credits.</p>
<p><a href="${APP_URL}/platform/billing">View plans →</a></p>`,
        })
      }
    }
  }

  return NextResponse.json({ received: true })
}
