import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlatformShell } from '@/components/layout/PlatformShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, avatar_url, role, persona_type, job_title, organisation, programme_name, google_email, tenant_id')
    .eq('id', user.id)
    .single()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, plan_status, subscription_status, ai_credits_used, ai_credits_limit, trial_ends_at, stripe_subscription_id')
    .eq('id', (profile as Record<string,unknown>)?.tenant_id ?? '')
    .single()

  return (
    <PlatformShell userProfile={profile as Record<string,unknown> | undefined} tenant={tenant as Record<string,unknown> | undefined}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </PlatformShell>
  )
}
