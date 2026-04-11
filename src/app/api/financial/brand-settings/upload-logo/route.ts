import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { getUserTenantProfile, resolveBrandLogoUrl } from '@/lib/financial/branding'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_SIZE_MB = 5

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const width = Number(formData.get('width') ?? 0) || null
    const height = Number(formData.get('height') ?? 0) || null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported logo type: ${file.type}` }, { status: 400 })
    }

    const sizeMb = file.size / (1024 * 1024)
    if (sizeMb > MAX_SIZE_MB) {
      return NextResponse.json({ error: `Logo exceeds ${MAX_SIZE_MB} MB` }, { status: 400 })
    }

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_').toLowerCase()
    const path = `${profile.tenant_id}/branding/logos/${Date.now()}_${safeName}`
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: uploadError } = await (supabase as any)
      .storage
      .from('pios-files')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) throw uploadError

    const existing = await supabase
      .from('brand_settings')
      .select('metadata')
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle()

    if (existing.error) throw existing.error

    const metadata = typeof existing.data?.metadata === 'object' && existing.data?.metadata !== null
      ? existing.data.metadata as Record<string, unknown>
      : {}

    const { error: updateError } = await supabase
      .from('brand_settings')
      .upsert({
        tenant_id: profile.tenant_id,
        created_by: user.id,
        updated_by: user.id,
        company_name: profile.organisation ?? profile.full_name ?? 'PIOS',
        company_email: user.email ?? null,
        email_sender_name: profile.organisation ?? profile.full_name ?? 'PIOS',
        email_from_name: profile.organisation ?? profile.full_name ?? 'PIOS',
        email_from_address: user.email ?? null,
        email_reply_to: user.email ?? null,
        company_logo_url: path,
        logo_url: path,
        logo_width: width ?? 200,
        logo_height: height ?? 60,
        metadata: {
          ...metadata,
          logo: {
            width,
            height,
            content_type: file.type,
            size_bytes: file.size,
            uploaded_at: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' })

    if (updateError) throw updateError

    const logo_url = await resolveBrandLogoUrl(path)

    return NextResponse.json({
      success: true,
      logo_path: path,
      logo_url,
      logo_width: width,
      logo_height: height,
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}