import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const admin = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [{ data: profile }, { data: accounts }] = await Promise.all([
      admin
        .from('user_profiles')
        .select('persona_type, active_modules, deployment_mode, cv_processing_status, google_access_token, onboarded')
        .eq('id', user.id)
        .single(),
      admin
        .from('connected_email_accounts')
        .select('provider, email_address, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true),
    ])

    const activeAccounts = accounts ?? []
    const googleConnected = !!profile?.google_access_token || activeAccounts.some(account => account.provider === 'google')
    const microsoftConnected = activeAccounts.some(account => account.provider === 'microsoft')

    return NextResponse.json({
      profile: {
        persona_type: profile?.persona_type ?? null,
        active_modules: profile?.active_modules ?? [],
        deployment_mode: profile?.deployment_mode ?? 'full',
        cv_processing_status: profile?.cv_processing_status ?? null,
        onboarded: profile?.onboarded ?? false,
      },
      integrations: {
        google_connected: googleConnected,
        microsoft_connected: microsoftConnected,
        connected_accounts: activeAccounts.length,
      },
    })
  } catch (error) {
    console.error('[onboarding/status]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}