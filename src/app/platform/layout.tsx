import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { PlatformShell } from '@/components/layout/PlatformShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const dynamic = 'force-dynamic'

const ONBOARDING_FEATURE_LAUNCH_DATE = '2026-04-22T14:00:00.000Z'

function isCreatedBeforeLaunch(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const ts = Date.parse(createdAt)
  if (Number.isNaN(ts)) return false
  return ts < Date.parse(ONBOARDING_FEATURE_LAUNCH_DATE)
}

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = (() => {
    try {
      return createServiceClient()
    } catch (error) {
      console.error('[platform/layout] service role unavailable; falling back to session client', error)
      return supabase
    }
  })()

  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('full_name, avatar_url, role, persona_type, active_personas, active_module_codes, job_title, organisation, programme_name, google_email, tenant_id, onboarded, onboarding_complete, onboarding_current_step, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[platform/layout] failed to load profile; bypassing onboarding gate to prevent lockout', {
      userId: user.id,
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    })
  }

  const isLegacyUser = isCreatedBeforeLaunch(user.created_at)
    || isCreatedBeforeLaunch(profile?.created_at)

  const explicitComplete = profile?.onboarding_complete === true || profile?.onboarded === true
  const bypassOnboarding = isLegacyUser || profile?.onboarding_complete == null
  const knownIncomplete = !profileError
    && !explicitComplete
    && !bypassOnboarding
    && (profile?.onboarding_complete === false || profile?.onboarded === false || profile == null)

  if (knownIncomplete) {
    const resumeStep = typeof profile?.onboarding_current_step === 'number'
      ? Math.min(6, Math.max(1, profile.onboarding_current_step))
      : 1
    redirect(`/onboarding?step=${resumeStep}`)
  }

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('plan, plan_status, subscription_status, ai_credits_used, ai_credits_limit, trial_ends_at, stripe_subscription_id')
    .eq('id', profile?.tenant_id ?? '')
    .maybeSingle()

  if (tenantError && profile?.tenant_id) {
    console.error('[platform/layout] failed to load tenant', {
      userId: user.id,
      tenantId: profile.tenant_id,
      code: tenantError.code,
      message: tenantError.message,
      details: tenantError.details,
      hint: tenantError.hint,
    })
  }

  return (
    <PlatformShell userProfile={profile as Record<string,unknown> | undefined} tenant={tenant as Record<string,unknown> | undefined}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </PlatformShell>
  )
}
