import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { buildDefaultBrandSettings, getUserTenantProfile, resolveBrandLogoUrl } from '@/lib/financial/branding'
import { buildDocumentHtml, type DocumentItemRow, type DocumentRow, type DocumentTemplateRow } from '@/lib/financial/documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { supabase, user, profile } = await getUserTenantProfile()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!profile) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single<DocumentRow>()
    if (documentError) throw documentError

    const [{ data: brandData, error: brandError }, { data: items, error: itemsError }, { data: template, error: templateError }] = await Promise.all([
      supabase.from('brand_settings').select('*').eq('tenant_id', profile.tenant_id).maybeSingle(),
      supabase.from('document_items').select('*').eq('document_id', id).order('sort_order', { ascending: true }) as PromiseLike<{ data: DocumentItemRow[] | null; error: unknown }>,
      document.template_id
        ? supabase.from('document_templates').select('*').eq('id', document.template_id).eq('tenant_id', profile.tenant_id).maybeSingle<DocumentTemplateRow>()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (brandError) throw brandError
    if (itemsError) throw itemsError
    if (templateError) throw templateError

    const brand = {
      ...(brandData ?? buildDefaultBrandSettings(profile)),
      logo_url: await resolveBrandLogoUrl((brandData as Record<string, unknown> | null)?.logo_url as string | null | undefined ?? (brandData as Record<string, unknown> | null)?.company_logo_url as string | null | undefined),
    }

    const html = buildDocumentHtml({
      brand,
      document,
      items: items ?? [],
      template: template ?? null,
    })

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    return apiError(err)
  }
}