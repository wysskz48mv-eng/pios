/**
 * /api/operator — White-label operator configuration
 * Read operator branding/features for current deployment
 * PIOS Sprint 25 | VeritasIQ Technologies Ltd
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get tenant → operator
    const { data: profile } = await supabase
      .from('user_profiles').select('tenant_id').eq('id', user.id).single()
    const prof = profile as Record<string,unknown> | null

    if (!prof?.tenant_id) {
      return NextResponse.json({ operator: null })
    }

    const { data: tenant } = await supabase
      .from('tenants').select('operator_id').eq('id', prof.tenant_id as string).single()
    const tenantData = tenant as Record<string,unknown> | null

    if (!tenantData?.operator_id) {
      return NextResponse.json({ operator: null })
    }

    const { data: operator } = await supabase
      .from('operator_configs')
      .select('operator_name,slug,logo_url,primary_colour,accent_colour,support_email,custom_domain,features_enabled,features_disabled,default_persona')
      .eq('id', tenantData.operator_id as string)
      .eq('active', true)
      .single()

    return NextResponse.json({ operator: operator ?? null })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only allow owner role
    const { data: profile } = await supabase
      .from('user_profiles').select('role,tenant_id').eq('id', user.id).single()
    const prof = profile as Record<string,unknown> | null
    if (prof?.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { action } = body as { action: string }

    // Update OKR notification prefs
    if (action === 'update_okr_prefs') {
      const { weekly_digest, drift_alerts, digest_day, email_address } = body as {
        weekly_digest: boolean; drift_alerts: boolean; digest_day: number; email_address?: string
      }
      const { data } = await supabase.from('okr_notification_prefs')
        .upsert({
          user_id: user.id,
          tenant_id: prof.tenant_id as string,
          weekly_digest, drift_alerts, digest_day,
          email_address: email_address ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select().single()
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
