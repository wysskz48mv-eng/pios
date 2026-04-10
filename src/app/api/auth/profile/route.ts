export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/auth/profile
 * Thin proxy to /api/profile — returns billing_email, google_email, full_name
 * for billing page and other consumers expecting this path.
 * PIOS Sprint 86 | VeritasIQ Technologies Ltd
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, billing_email, google_email, avatar_url, job_title, organisation, persona_type')
      .eq('id', user.id)
      .single()

    return NextResponse.json({ profile: profile ?? null })
  } catch (e: unknown) {
    return apiError(e)
  }
}
