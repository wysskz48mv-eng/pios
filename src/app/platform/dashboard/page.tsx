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
    .select('id, full_name, display_name, persona_type, command_centre_theme, onboarded, onboarding_complete, onboarding_current_step, plan, job_title, organisation')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')
  const onboarded = profile.onboarding_complete === true || profile.onboarded === true
  if (!onboarded) {
    const resumeStep = typeof profile.onboarding_current_step === 'number'
      ? Math.min(6, Math.max(1, profile.onboarding_current_step))
      : 1
    redirect(`/onboarding?step=${resumeStep}`)
  }

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