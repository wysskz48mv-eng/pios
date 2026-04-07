import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CommandCentre } from '@/components/command-centre/CommandCentre'
import type { CCTheme } from '@/lib/themes'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, display_name, persona_type, command_centre_theme, onboarded, plan, job_title, organisation')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')
  if (!profile.onboarded) redirect('/onboarding')

  return (
    <CommandCentre
      profile={{
        id: profile.id,
        name: profile.display_name ?? profile.full_name ?? 'You',
        fullName: profile.full_name ?? '',
        persona: profile.persona_type ?? 'professional',
        theme: (profile.command_centre_theme ?? 'onyx') as CCTheme,
        plan: profile.plan ?? 'free',
        jobTitle: profile.job_title ?? '',
        organisation: profile.organisation ?? '',
      }}
    />
  )
}