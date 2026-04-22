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
    .select('full_name, avatar_url, role, persona_type, job_title, organisation, programme_name, google_email, tenant_id, onboarded, onboarding_complete, onboarding_current_step')
    .eq('id', user.id)
    .single()

  // Onboarding gate — redirect incomplete users
  const onboarded = profile?.onboarding_complete === true || profile?.onboarded === true
  if (!onboarded) {
    const resumeStep = typeof profile?.onboarding_current_step === 'number'
      ? Math.min(6, Math.max(1, profile.onboarding_current_step))
      : 1
    redirect(`/onboarding?step=${resumeStep}`)
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
