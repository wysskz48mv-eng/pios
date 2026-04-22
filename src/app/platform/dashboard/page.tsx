import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CommandCentre } from '@/components/command-centre/CommandCentre'
import type { CCTheme } from '@/lib/themes'

const ONBOARDING_FEATURE_LAUNCH_DATE = '2026-04-22T14:00:00.000Z'

function isCreatedBeforeLaunch(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false
  const ts = Date.parse(createdAt)
  if (Number.isNaN(ts)) return false
  return ts < Date.parse(ONBOARDING_FEATURE_LAUNCH_DATE)
}

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, full_name, display_name, persona_type, command_centre_theme, onboarded, onboarding_complete, onboarding_current_step, plan, job_title, organisation, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[platform/dashboard] profile read failed; preventing hard lockout', {
      userId: user.id,
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
    })
  }

  if (!profile && !profileError) redirect('/auth/login')

  const isLegacyUser = isCreatedBeforeLaunch(user.created_at) || isCreatedBeforeLaunch(profile?.created_at)
  const explicitComplete = profile?.onboarding_complete === true || profile?.onboarded === true
  const bypassOnboarding = isLegacyUser || profile?.onboarding_complete == null
  const knownIncomplete = !profileError
    && !explicitComplete
    && !bypassOnboarding
    && (profile?.onboarding_complete === false || profile?.onboarded === false)

  if (knownIncomplete) {
    const resumeStep = typeof profile?.onboarding_current_step === 'number'
      ? Math.min(6, Math.max(1, profile.onboarding_current_step))
      : 1
    redirect(`/onboarding?step=${resumeStep}`)
  }

  return (
    <CommandCentre
      profile={{
        id: profile?.id ?? user.id,
        name: profile?.display_name ?? profile?.full_name ?? 'You',
        fullName: profile?.full_name ?? '',
        persona: profile?.persona_type ?? 'professional',
        theme: (profile?.command_centre_theme ?? 'onyx') as CCTheme,
        plan: profile?.plan ?? 'free',
        jobTitle: profile?.job_title ?? '',
        organisation: profile?.organisation ?? '',
      }}
    />
  )
}
