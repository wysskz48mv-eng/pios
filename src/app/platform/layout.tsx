import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { PlatformShell } from '@/components/layout/PlatformShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Use service client for reliable DB read — bypasses RLS + cookie issues
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await admin
    .from('user_profiles')
    .select('full_name, avatar_url, role, persona_type, job_title, organisation, programme_name, google_email, tenant_id, onboarded')
    .eq('id', user.id)
    .single()

  // Onboarding gate — redirect unboarded users
  if (profile?.onboarded === false) {
    redirect('/onboarding')
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('plan, plan_status, subscription_status, ai_credits_used, ai_credits_limit, trial_ends_at, stripe_subscription_id')
    .eq('id', profile?.tenant_id ?? '')
    .single()

  return (
    <PlatformShell userProfile={profile as Record<string,unknown> | undefined} tenant={tenant as Record<string,unknown> | undefined}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </PlatformShell>
  )
}
