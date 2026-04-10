import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/vault/folders
 * Returns all vault folders with document counts.
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {  
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  
    const { data: folders } = await supabase
      .from('vault_folders')
      .select('*, vault_document_folders(count)')
      .eq('user_id', user.id)
      .order('folder_type', { ascending: true })
      .order('name', { ascending: true })
  
    const enriched = (folders ?? []).map(f => ({
      ...f,
      doc_count: f.vault_document_folders?.[0]?.count ?? 0,
    }))
  
    return NextResponse.json({ folders: enriched })
  
  } catch (err: any) {
    console.error('[PIOS]', err)
    return apiError(err)
  }
}
