import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/vault/documents
 * Returns all vault documents for the user with stats.
 * VeritasIQ Technologies Ltd · PIOS Sprint K
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: documents } = await supabase
    .from('vault_documents')
    .select(`
      *,
      stakeholder:stakeholders(name, organisation),
      decision:executive_decisions(title),
      proposal:proposals(title)
    `)
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  const docs = documents ?? []

  // Compute stats
  const now = new Date()
  const in90 = new Date(now.getTime() + 90 * 86400000)

  const stats = {
    total:        docs.length,
    expiring_soon: docs.filter(d => d.expiry_date && new Date(d.expiry_date) <= in90 && new Date(d.expiry_date) > now).length,
    needs_review: docs.filter(d => d.requires_review).length,
    by_type:      docs.reduce((acc, d) => { acc[d.doc_type] = (acc[d.doc_type] ?? 0) + 1; return acc }, {} as Record<string, number>),
  }

  return NextResponse.json({ documents: docs, stats })
}
