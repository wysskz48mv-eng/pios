import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PlatformShell } from '@/components/layout/PlatformShell'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, avatar_url, role, programme_name, google_email')
    .eq('id', user.id)
    .single()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, ai_credits_used, ai_credits_limit')
    .eq('id', (profile as any)?.tenant_id ?? '')
    .single()

  return (
    <PlatformShell userProfile={profile} tenant={tenant}>
      {children}
    </PlatformShell>
  )
}
