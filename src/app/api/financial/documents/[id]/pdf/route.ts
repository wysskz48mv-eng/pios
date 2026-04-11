import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-error'
import { buildDefaultBrandSettings, getUserTenantProfile, resolveBrandLogoUrl } from '@/lib/financial/branding'
import { buildDocumentHtml, type DocumentItemRow, type DocumentRow, type DocumentTemplateRow } from '@/lib/financial/documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getCachedPdfBytes(supabase: any, path: string | null | undefined) {
  if (!path) return null
  const { data, error } = await supabase.storage.from('pios-files').download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

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

    const [{ data: pdfCache, error: pdfError }, { data: brandData, error: brandError }, { data: items, error: itemsError }, { data: template, error: templateError }] = await Promise.all([
      supabase.from('document_pdfs').select('*').eq('document_id', id).maybeSingle(),
      supabase.from('brand_settings').select('*').eq('tenant_id', profile.tenant_id).maybeSingle(),
      supabase.from('document_items').select('*').eq('document_id', id).order('sort_order', { ascending: true }) as PromiseLike<{ data: DocumentItemRow[] | null; error: unknown }>,
      document.template_id
        ? supabase.from('document_templates').select('*').eq('id', document.template_id).eq('tenant_id', profile.tenant_id).maybeSingle<DocumentTemplateRow>()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (pdfError) throw pdfError
    if (brandError) throw brandError
    if (itemsError) throw itemsError
    if (templateError) throw templateError

    const cachedStillValid = pdfCache?.pdf_url
      && (!pdfCache.expires_at || new Date(pdfCache.expires_at).getTime() > Date.now())
      && (!document.updated_at || new Date(pdfCache.generated_at).getTime() >= new Date(document.updated_at).getTime())

    if (cachedStillValid) {
      const cachedBytes = await getCachedPdfBytes(supabase as any, pdfCache.pdf_url)
      if (cachedBytes) {
        return new NextResponse(cachedBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${document.document_number}.pdf"`,
            'Cache-Control': 'private, max-age=3600',
          },
        })
      }
    }

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

    const { chromium } = await import('@playwright/test')
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle' })
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
      })

      const path = `${profile.tenant_id}/documents/pdfs/${document.id}-${Date.now()}.pdf`
      const { error: uploadError } = await (supabase as any).storage.from('pios-files').upload(path, pdf, {
        contentType: 'application/pdf',
        upsert: true,
      })
      if (!uploadError) {
        await supabase.from('document_pdfs').upsert({
          document_id: document.id,
          pdf_url: path,
          pdf_size: pdf.byteLength,
          generated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toISOString(),
        }, { onConflict: 'document_id' })
      }

      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${document.document_number}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    } finally {
      await browser.close()
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF'
    if (/playwright|browser|executable/i.test(message)) {
      return NextResponse.json({ error: 'PDF generation runtime is unavailable', detail: message }, { status: 503 })
    }
    return apiError(err)
  }
}