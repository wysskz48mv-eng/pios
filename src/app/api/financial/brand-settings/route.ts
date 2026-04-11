import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import {
  buildDefaultBrandSettings,
  getUserTenantProfile,
  resolveBrandLogoUrl,
  sanitizeBrandSettingsInput,
} from '@/lib/financial/branding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const { data, error } = await supabase
      .from('brand_settings')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle()

    if (error) throw error

    const settings = data ?? buildDefaultBrandSettings(profile)
    const logo_url = await resolveBrandLogoUrl(settings.logo_url ?? settings.company_logo_url)

    return NextResponse.json({
      ...settings,
      logo_url,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const body = await request.json() as Record<string, unknown>
    const payload = sanitizeBrandSettingsInput(body, profile)
    const timestamp = new Date().toISOString()

    const { data, error } = await supabase
      .from('brand_settings')
      .upsert({
        ...payload,
        created_by: user.id,
        updated_by: user.id,
        updated_at: timestamp,
      }, { onConflict: 'tenant_id' })
      .select('*')
      .single()

    if (error) throw error

    const logo_url = await resolveBrandLogoUrl(data.logo_url ?? data.company_logo_url)

    return NextResponse.json({
      success: true,
      updated_settings: {
        ...data,
        logo_url,
      },
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}