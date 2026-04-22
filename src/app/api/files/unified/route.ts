import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    const source = request.nextUrl.searchParams.get('source') ?? 'all'
    const limit = Math.min(200, Math.max(20, Number(request.nextUrl.searchParams.get('limit') ?? '80')))

    const shouldFetchFiles = source === 'all' || source === 'file_items'
    const shouldFetchDocs = source === 'all' || source === 'project_source_documents'

    const [filesRes, docsRes] = await Promise.all([
      shouldFetchFiles
        ? supabase
            .from('file_items')
            .select('id,name,file_type,ai_summary,created_at,updated_at,drive_web_url,size')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      shouldFetchDocs
        ? supabase
            .from('project_source_documents')
            .select('id,filename,file_type,source_content,file_size_bytes,uploaded_at,updated_at')
            .eq('user_id', user.id)
            .order('uploaded_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ])

    let items = [
      ...(filesRes.data ?? []).map((f: Record<string, unknown>) => ({
        source: 'file_items',
        id: f.id,
        name: f.name,
        file_type: f.file_type,
        summary: f.ai_summary,
        size_bytes: f.size,
        created_at: f.created_at,
        updated_at: f.updated_at,
        url: f.drive_web_url,
      })),
      ...(docsRes.data ?? []).map((d: Record<string, unknown>) => ({
        source: 'project_source_documents',
        id: d.id,
        name: d.filename,
        file_type: d.file_type,
        summary: d.source_content,
        size_bytes: d.file_size_bytes,
        created_at: d.uploaded_at,
        updated_at: d.updated_at,
        url: null,
      })),
    ]

    if (query) {
      const q = query.toLowerCase()
      items = items.filter((item) => String(item.name ?? '').toLowerCase().includes(q) || String(item.summary ?? '').toLowerCase().includes(q))
    }

    items.sort((a, b) => new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime())

    return NextResponse.json({
      count: items.length,
      items,
      summary: {
        file_items: items.filter((i) => i.source === 'file_items').length,
        project_source_documents: items.filter((i) => i.source === 'project_source_documents').length,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
